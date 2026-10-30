# CODE-REVIEW-1042-r3

Issue: #1042 · этап code · заход r3 · блокирующих циклов использовано 1 из 2 (лимит track:show)
Материал: `3a6af8fef907d344bbe4663553375a4335fa7b49` (рабочая копия на нём; `origin/dev..HEAD` = 5 коммитов)
Трек: show (владельцем подтверждён); ветка не приводилась к `dev` — `dev` впереди на 4 коммита, слияние без конфликта (REVIEWER.md, «Трек show», #696)
Маршрут побочных находок: mode=issues (доверенный снимок prepare совпадает с `REVIEW_FINDINGS_POLICY`, побочных находок нет)

## Скоуп

Раунд r3 оценивает дельту поверх уже зелёного r2. Пять коммитов в `origin/dev..HEAD`:

| Коммит | Автор | Содержание |
|---|---|---|
| `323a17aba` | автор | r1-правка: перенос `wall_fill`-плашки в четырёх смоках + ledger (класс B/C) |
| `77794e63a` | pipeline (`claude[bot]`) | публикация `docs/reviews/CODE-REVIEW-1042-r1.md` |
| `9db5ffa56` | автор | r2-правка M1: нестандартные `room_color`/`room_opacity`/`wall_fill` в фикстуре `smoke_room_dimming_removed.mjs` + `acceptance.md` |
| `3931988dd` | pipeline | публикация `docs/reviews/CODE-REVIEW-1042-r2.md` |
| `3a6af8fef` | pipeline | **дельта r2→r3**: регенерация `docs/reviews/INDEX.md` после добавления двух строк `#1042` |

Дельта r2→r3 — ровно один файл, `docs/reviews/INDEX.md` (+3/-1 строка),
автоматически сгенерированный `node scripts/reviews-index.mjs`; `src/**`,
`demo/**`, `docs/release-ledger/**`, `docs/reviews/evidence-1042/acceptance.md`
не тронуты (`git diff 9db5ffa56..3a6af8fef --stat` — только
`CODE-REVIEW-1042-r2.md` (новый документ, публикация) и `INDEX.md`). Класс C,
доки-only — трейлеры не обязательны, но коммит их несёт корректно (`Issue:
#1042`, `User-Visible: no`).

Старые якоря в «Материал раунда» r1/r2 (`8a3a0f9d2…`, `eb06ed0ef…`,
`5977e5515…`) не резолвятся в текущей истории ветки — её метаданные
переписаны после публикации этих документов. Это не находка (REVIEWER.md,
«Повторный раунд»: «если SHA не резолвится… находка — SHA, мёртвый уже в
момент публикации», а не последующая перезапись). Содержимое, которое
описывают r1/r2, сверено построчно с текущим деревом ниже и совпадает
побайтово — переписанная история не изменила ни одной проверки.

Инфраструктурная задача (класс B/C) обслуживает «View mode — продукт»
(docs/SCOPE.md) косвенно: снимает ложный блокер с полного Validate #1035, не
меняя поведение продукта. Подсистема по `docs/reviews/INDEX.md` — смежный
#1037 зелёный, ожидаемое поведение уже зафиксировано там и в
`src/room-appearance.ts`.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Материал = HEAD | `git rev-parse HEAD` | `3a6af8fef907d344bbe4663553375a4335fa7b49` — совпадает с заявленным |
| Дельта r2→r3 изолирована | `git diff 9db5ffa56..3a6af8fef --stat` | Только `CODE-REVIEW-1042-r2.md` (публикация, 208 строк) и `INDEX.md` (+3/-1); `src/`, `demo/`, ledger, `acceptance.md` не тронуты |
| Корректность регенерации | `node scripts/reviews-index.mjs --check` | `docs/reviews/INDEX.md свеж` — закоммиченный файл побайтово совпадает с тем, что выдаёт генератор; ручной правки нет |
| Дешёвые гейты (typecheck/test/build/bundle) | — | Не перегонялись: зелёный Validate подтверждён на точном SHA материала `3a6af8fef` (https://github.com/Matysh/houseplan-card/actions/runs/39922716880, `conclusion: success`) — согласно правилам раунда, повторный прогон не нужен |

Содержимое строк `#1042` в новом `INDEX.md` сверено с самими документами:
`CODE-REVIEW-1042-r1.md` действительно 🟡/0 High/1 Medium (находка M1, см.
ниже), `CODE-REVIEW-1042-r2.md` действительно 🟢/0/0 — оба числа и обе
ссылки корректны, счётчик «Документов: 50, issue: 26» на две позиции больше
прежних 48/25 (ровно r1+r2, #1042 ранее в индексе не значился).

Четыре смока, формула `spaceAppearanceOf` и ledger-классификация не
перезапускались и не разбирались заново в этой сессии — неизменившийся
пригодный check с r2 (см. «Унаследовано из r2»); дельта r3 их не касается.

## Находки

Нет.

## Закрытие раунда r2

Находок в r2 не было (вердикт зелёный, 0 High / 0 Medium) — закрывать
нечего. Единственная находка всего цикла (M1, r1) была закрыта уже в r2 и
подтверждена построчно в документе r2 («Закрытие раунда r1»); в r3 это
содержимое не менялось (см. «Унаследовано из r2»).

## Унаследовано из r2

Без повторной проверки приняты (документ `docs/reviews/CODE-REVIEW-1042-r2.md`,
материал раунда r2 — логически тот же коммит, что сейчас `9db5ffa56`, с
переписанными метаданными после r2; содержимое идентично, см. выше):

- Формула материализации `spaceAppearanceOf()` (`src/room-appearance.ts:22-34`)
  сверена построчно с фикстурой `smoke_room_dimming_removed.mjs`
  (`room_color='#c84927'`, `room_opacity=.25` → `name_color={c:'#c84927',a:.5}`;
  `general.fill_colors.wall_fill={c:'#143a52',a:.35}` → тот же `wall_fill`) —
  оба канала отличимы от `DEFAULT_NAME_COLOR`/`DEFAULT_WALL_FILL` по цвету и
  alpha, закрывает находку M1 (мутант, откатывающий любой канал к дефолту,
  был бы пойман по формуле; не исполнялся — политика #905).
- Перенос `wall_fill`-плашки из общих настроек в настройки пространства в
  четырёх смоках (состав формы, число плашек/hex-меток, изоляция
  `gs-glow-color`/`colors.wall_fill`) — построчно по
  `general-settings-dialog.ts`/`space-form.ts`/`hp-color-opacity.ts` и
  исполнением всех четырёх смоков, PASS на r1.
- `smoke_room_dimming_removed`: отсутствие retired darkness, единственная
  явная запись при Save, откат черновика при Cancel — не затронуты дельтой
  r1→r2 кроме двух строк материализации (уже разобраны выше), не затронуты и
  дельтой r2→r3.
- `docs/release-ledger/v1.82.0/1042.json`: категория `infra` обоснована
  относительно `v1.82.0`, без `introducedBy` (не требуется для infra) — файл
  не менялся с r1.
- `acceptance.md`: честная запись «No mutant was executed to make this
  claim» для защитного AC — не менялась с r2.
- Типчек/юнит-тесты/сборка PASS на r1 (лично) и подтверждены зелёным Validate
  CI на материале r2 и материале r3 (тот же src/-срез).

## Что проверено и корректно

- Дельта r2→r3 — исключительно автогенерированный `docs/reviews/INDEX.md`
  (регенерация после публикации доки r2) плюс сама публикация документа r2;
  ни одна проверяемая поверхность (`src/`, смоки, ledger, acceptance) не
  затронута.
- `node scripts/reviews-index.mjs --check` подтверждает: закоммиченный
  `INDEX.md` побайтово совпадает со свежей генерацией — новые строки для
  #1042 корректны по вердикту, числам H/M и ссылкам на оба документа.
- `git rev-parse HEAD` совпадает с материалом вердикта (`3a6af8fef`); гейты
  подтверждены зелёным Validate на этом точном SHA.
- Трейлеры коммита дельты (`3a6af8fef`) корректны: `Issue: #1042`,
  `User-Visible: no` — доки-only, продукт не меняется, оба changelog не
  требуются.
- Унаследованное содержимое r1→r2 (формула, перенос плашки, ledger) — сверено
  байт-в-байт с текущим деревом, расхождений с переписанной историей нет.

## Чего не проверял

- `golden:verify` — не запускал: нет метки `ci:golden`, зрительный путь
  отрисовки плана не затронут ни в этой дельте, ни во всём диапазоне.
- `pytest tests_backend` — не запускал: Python не тронут.
- `npm run invariants` — не запускал: геометрия модели не тронута.
- Performance-гейты — не запускал: не названы в AC, рендер не изменён.
- `npx tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify`
  отдельно в этой сессии — не повторял: зелёный Validate на точном SHA
  материала (`3a6af8fef`, run 39922716880) подтверждён, а дельта r3 эти
  поверхности не трогает.
- Четыре смока (`smoke_dialog_polish_605`, `smoke_general_settings_form`,
  `smoke_room_appearance`, `smoke_room_dimming_removed`) — не перезапускал в
  этой сессии: их исполняемые источники не входят в дельту r2→r3, уже PASS на
  r1/r2 лично ревьюером.
- Полный `gate:small` / `process-gate.mjs --issues` на точном SHA — не
  повторял; не относится к объёму ревью на show.
- Ручная dev/GPU-приёмка владельцем — не проводилась и не требуется
  (REVIEWER.md, «Позиция ревьюера»).
- Мутант на `spaceAppearanceOf`/`appearanceColorOf` — не исполнялся (общая
  политика, #905); вывод о различимости от дефолта сделан чтением формулы и
  арифметикой, унаследован из r2.

## Вердикт

Дельта r2→r3 — доки-only регенерация индекса, подтверждена скриптом как
корректная и не затрагивающая ни одну проверяемую поверхность. Находок нет,
унаследованное содержимое r1/r2 (включая закрытую находку M1) остаётся в
силе. High: 0, Medium: 0 → зелёный вердикт. Маршрут: `fix` — задача
по-прежнему укладывается в критерии §5 трека show (сложность и риск низкие —
точечная автогенерация индекса; одна поверхность — тот же набор демо-смоков и
служебная документация; без миграции конфига; без нового UX-контракта; без
влияния на производительность/touch; ожидаемое поведение зафиксировано
принятым #1037 и `src/room-appearance.ts`). Зелёный вердикт цикла не
образует и бюджет не тратит (использовано 1/2, со времён r1).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1042-appearance-smokes`, коммит `3a6af8fef907` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `17d1a525056371a0e26ef2549afd8d44fe1d8304`
  ```
  git log --all --format='%H %T' | grep 17d1a5250563
  ```
- Тело issue: `21e997e68c730ade5197fa2c2fca98f315e8299bf06cb883654bd88200921782`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTQsIm91dHB1dF90b2tlbnMiOjIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzA4OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjYsIm91dHB1dF90b2tlbnMiOjE3Nzg0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjc1NTQ2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6ODQxMzI4LCJjb3N0VXNkRXN0aW1hdGUiOjAuNjQ4MzQxNjAwMDAwMDAwMX1dLCJ0dXJucyI6MTksImR1cmF0aW9uTXMiOjIwOTk1OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjUzNjUwNjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5220 output_tokens=17807 cache_creation_input_tokens=75546 cache_read_input_tokens=841328 num_turns=19 -->
