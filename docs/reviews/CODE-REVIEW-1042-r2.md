# CODE-REVIEW-1042-r2

Issue: #1042 · этап code · заход r2 · блокирующих циклов использовано 1 из 2 (лимит track:show)
Материал: `eb06ed0ef74ea774a9aee3f13f4ddf8a652ccda4` (рабочая копия на нём; `origin/dev..HEAD` = 2 коммита: `5977e5515` docs, `eb06ed0ef` test)
Трек: show (владельцем подтверждён)
Маршрут побочных находок: mode=issues (снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`, доверенный снимок prepare совпадает с `REVIEW_FINDINGS_POLICY`)

## Скоуп

Round r2 — исправление единственной находки r1 (M1): дефектная фикстура в
`demo/smoke_room_dimming_removed.mjs`, доказывавшая защитный AC «эффективные
legacy-цвета по #1037» значениями, совпадающими с дефолтами резолвера, и
несуществующим полем `settings.border_color`. Дельта r1→r2 — ровно два файла:

- `demo/smoke_room_dimming_removed.mjs` (9 строк): фикстура пространства
  получает `room_color: '#c84927', room_opacity: .25` вместо общего
  несуществующего `border_color`; общий `fill_colors.wall_fill` меняется с
  `{c:'#ffffff',a:1}` (= дефолт) на `{c:'#143a52',a:.35}`; ожидание
  `name_color`/`wall_fill` в ассерте следует новым входам.
- `docs/reviews/evidence-1042/acceptance.md`: описание обновлено под новые
  значения, добавлен абзац «Review M1 correction» с честной записью «No
  mutant was executed to make this claim».

`src/**`, остальные три смока (`smoke_dialog_polish_605`,
`smoke_general_settings_form`, `smoke_room_appearance`),
`docs/release-ledger/v1.82.0/1042.json` не изменились с r1 — дельта локальна,
полный разбор подсистемы не требуется (REVIEWER.md, «Повторный раунд»).
Коммит `eb06ed0ef` несёт `Issue: #1042` / `User-Visible: no` — верно,
продукт не меняется.

Инфраструктурная задача (класс B/C) обслуживает «View mode — продукт»
(docs/SCOPE.md) косвенно: снимает ложный блокер с полного Validate #1035,
не меняя поведение. Подсистема — `docs/reviews/INDEX.md` перед разбором:
смежный #1037 (контракт переноса цветов) зелёный на code-review r1 и spec
r3 — ожидаемое поведение, которое проверяет этот смок, уже зафиксировано там
и в `src/room-appearance.ts`.

## Как проверялось

Зелёный Validate на точном SHA материала подтверждён через API
(`gh run view 39921230849` → `conclusion: success`, `headSha` совпадает с
`eb06ed0ef74ea774a9aee3f13f4ddf8a652ccda4`) — согласно правилам раунда,
`tsc --noEmit`/`npm test`/`npm run build`+`bundle-policy --verify` на этом не
перегонялись.

Дополнительно лично в этой сессии (т.к. именно эти шаги трогает дельта):

| Гейт | Команда | Результат |
|---|---|---|
| Build + bundle sync | `npm run bundle:sync` | PASS, `dist` пересобран, бандл-дерево синхронизировано в `demo/srv/assets` |
| Bundle policy | `node scripts/bundle-policy.mjs --verify` | PASS — «свежая сборка dist цела (61 ассет); закоммиченная копия не сверяется» (бандл кандидата, #657) |
| Изменённый смок | `node demo/smoke_room_dimming_removed.mjs` | PASS, 28 проверок, pinned Chromium 151.0.7922.34 (совпадает с заявленным автором) |

Остальные три названных в теле issue смока не перезапускались: их
исполняемые источники и продукт не изменились с r1, где они уже прогонялись
лично ревьюером и были PASS (CODE-REVIEW-1042-r1.md, раздел «Как
проверялось») — неизменившийся пригодный check, повторять незачем
(REVIEWER.md, «Повторный раунд»).

**Разбор защитного AC — построчно, чтением (без исполнения мутанта,
согласно общей политике):**

Формула `spaceAppearanceOf()` (`src/room-appearance.ts:22-34`):
`legacyName = { c: safeStoredColor(settings.room_color, '#55606c'),
a: min(1, opacity + 0.25) }`, где `opacity` — `settings.room_opacity`
(clamped, дефолт `0.55`); `legacyWall = appearanceColorOf(general.fill_colors
.wall_fill, DEFAULT_WALL_FILL)`.

Подстановка новых фикстурных значений: `room_opacity=.25` → `a = .25+.25 =
.5`; `room_color='#c84927'` проходит `STORED_COLOR_RE` (`src/color.ts:10-13`,
обычный 6-значный hex) → `c='#c84927'`. Итог `name_color={c:'#c84927',a:.5}`
— совпадает с ожиданием в ассерте (`demo/smoke_room_dimming_removed.mjs:185`)
и отличается от `DEFAULT_NAME_COLOR` (`{c:'#55606c',a:.8}`,
`src/room-appearance.ts:6`) и по цвету, и по alpha. Для стены:
`general.fill_colors.wall_fill={c:'#143a52',a:.35}` читается напрямую через
`appearanceColorOf`, совпадает с ожиданием и отличается от
`DEFAULT_WALL_FILL` (`{c:'#ffffff',a:1}`) и по цвету, и по alpha.

Это закрывает ровно то, что было найдено в r1: мутант, убирающий чтение
`room_color`/`room_opacity` (откат к дефолту `'#55606c'`/`opacity??0.55`),
дал бы `name_color={c:'#55606c',a:.8}` ≠ ожидаемому `{c:'#c84927',a:.5}` —
тест упал бы. Мутант, убирающий чтение `general.fill_colors.wall_fill`, дал
бы `wall_fill=DEFAULT_WALL_FILL={c:'#ffffff',a:1}` ≠ ожидаемому
`{c:'#143a52',a:.35}` — тест тоже упал бы. Оба канала теперь различимы от
«всегда отдаёт дефолт», что было ровно предметом находки M1. Мутант не
исполнялся (политика #905) — вывод сделан чтением исходника и арифметикой
над открытой, неизменной формулой; совпадает с самостоятельной записью
автора в `acceptance.md` («No mutant was executed to make this claim»).

Проверено дополнительно: `border_color` полностью убран из фикстуры (grep по
файлу — не осталось ни одного упоминания), висячих ссылок не осталось;
остальная строгая проверка `saved.spaces` (`...space.settings` спред) и счётчик
одной записи config/set (:187-188) не ослаблены.

Трейлеры `eb06ed0ef`: `Issue: #1042`, `User-Visible: no` — корректно, без
продуктовых изменений changelog не нужен. Числа, видимые пользователю, в
дельте отсутствуют (смок внутренний, не пользовательский UI).

Не проверялось намеренно (как и в r1, объём гейта ревью на show,
инфраструктурная задача без правки geometry/Python/perf):
`golden:verify` (нет `ci:golden`), `pytest tests_backend` (Python не
тронут), `npm run invariants` (геометрия не тронута), performance (не
назван в AC), полный `gate:small`/`process-gate --issues` на точном SHA
(автор привёл PASS в хендоффе; не гейт ревью), ручная dev/GPU-приёмка (не
требуется, REVIEWER.md «Позиция ревьюера»).

## Находки

Нет. Находка M1 из r1 закрыта по существу: фикстура больше не опирается на
неиспользуемое поле и не совпадает побайтово с дефолтами резолвера ни по
одному из двух каналов.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: «эффективные legacy-цвета» в `smoke_room_dimming_removed.mjs` доказаны не тем, чем заявлено — `border_color` не читается нигде, `wall_fill`-фикстура совпадала с дефолтом | Фикстура пространства заменена на реально читаемые `settings.room_color='#c84927'`/`settings.room_opacity=.25`; `general.fill_colors.wall_fill` заменён с дефолтного `{c:'#ffffff',a:1}` на нестандартный `{c:'#143a52',a:.35}`; ожидание в ассерте пересчитано под формулу `spaceAppearanceOf` (`a=opacity+0.25=.5`) | `demo/smoke_room_dimming_removed.mjs:27-32,185` (диффа `8a3a0f9d2..eb06ed0ef`); описание синхронизировано в `docs/reviews/evidence-1042/acceptance.md:24-30,39-44` |

## Унаследовано из r1

Без повторной проверки приняты (документ `docs/reviews/CODE-REVIEW-1042-r1.md`,
материал `8a3a0f9d2f742e796ab07876b16043d3a7b4e99d`, дерево
`21d64f2071b5bd8f2038c8401522dce9465b04c7`), так как дельта r1→r2 их не
касается:

- Перенос `wall_fill`-плашки из общих настроек в настройки пространства во
  всех четырёх смоках (состав формы, числа плашек/hex-меток, изоляция
  `gs-glow-color`/`colors.wall_fill`) — проверено построчно по
  `general-settings-dialog.ts`/`space-form.ts`/`hp-color-opacity.ts` и
  исполнением `smoke_dialog_polish_605`, `smoke_general_settings_form`,
  `smoke_room_appearance` (все PASS на r1).
- `smoke_room_dimming_removed`: отсутствие retired darkness (пиксели, роли),
  единственная явная запись при Save, откат черновика при Cancel — эти
  проверки в дельте r1→r2 не менялись, только две строки материализации.
- `docs/release-ledger/v1.82.0/1042.json`: категория `infra` обоснована
  относительно `v1.82.0`, без `introducedBy` (не требуется для infra) —
  файл не менялся с r1.
- Типчек/юнит-тесты/сборка PASS на предыдущем SHA (r1, лично) и на текущем
  (Validate CI, подтверждено API-запросом).

## Что проверено и корректно

- Делта r1→r2 — точечный исправляющий коммит, ровно по месту находки M1, без
  побочных правок скоупа (`src/`, остальные три смока и ledger не тронуты).
- Формула материализации (`spaceAppearanceOf`, `src/room-appearance.ts:22-34`)
  сверена построчно с новыми фикстурными значениями и ожиданием в ассерте —
  арифметика (`.25+.25=.5`) и цвет совпадают, оба поля теперь отличимы от
  дефолтов резолвера по обоим осям (цвет и alpha).
- Смок исполняется и проходит на пересобранном бандле: `node
  demo/smoke_room_dimming_removed.mjs` → PASS, 28 проверок — число совпадает
  с заявленным автором.
- `acceptance.md` честно фиксирует, что мутант не исполнялся, и описывает
  правку точно тем же языком, что и код (независимые литералы, не вызов
  резолвера в oracle).
- Трейлеры коммита корректны; `User-Visible: no` оправдан отсутствием
  изменений в продукте.

## Чего не проверял

- `golden:verify` — не запускал: нет метки `ci:golden`, зрительный путь
  отрисовки плана не затронут.
- `pytest tests_backend` — не запускал: Python не тронут.
- `npm run invariants` — не запускал: геометрия модели не тронута.
- Performance-гейты — не запускал: не названы в AC, диффа в рендере нет.
- `npx tsc --noEmit` / `npm test` отдельно в этой сессии — не повторял:
  зелёный Validate на точном SHA `eb06ed0ef` подтверждён через
  `gh run view 39921230849` (success, headSha совпадает); src/ с r1 не
  менялся.
- Три неизменённых смока (`smoke_dialog_polish_605`,
  `smoke_general_settings_form`, `smoke_room_appearance`) — не перезапускал
  в этой сессии: их материал не входит в дельту r1→r2, уже PASS на r1 лично.
- Полный `gate:small` / `process-gate.mjs --issues` на точном SHA — не
  повторял; автор привёл их PASS в хендоффе, это не заменяет вердикт, но и
  не относится к объёму ревью на show.
- Ручная dev/GPU-приёмка владельцем — не проводилась и не требуется
  (REVIEWER.md, «Позиция ревьюера»).
- Мутант на `spaceAppearanceOf`/`appearanceColorOf` — не исполнялся ни
  сейчас, ни в r1: общая политика запрещает исполнение мутанта продукта вне
  ночного workflow; вывод о различимости от дефолта сделан чтением формулы
  и арифметикой над конкретными числами (см. «Как проверялось»).

## Вердикт

Находка M1 из r1 закрыта по существу и подтверждена чтением формулы и
исполнением изменённого смока; новых находок нет. High: 0, Medium: 0 →
зелёный вердикт. Маршрут: `fix` — задача по-прежнему укладывается в
критерии §5 трека show (сложность и риск низкие — точечная правка двух
тестовых значений; одна поверхность — тот же набор демо-смоков; без
миграции конфига; без нового UX-контракта; без влияния на
производительность/touch; ожидаемое поведение зафиксировано принятым
#1037 и `src/room-appearance.ts`). Зелёный вердикт цикла не образует и
бюджет не тратит (использовано 1/2 от r1).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1042-appearance-smokes`, коммит `eb06ed0ef74e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f3e0d22e7ecadd0639129fea99e7ad0701f5e33e`
  ```
  git log --all --format='%H %T' | grep f3e0d22e7eca
  ```
- Тело issue: `21e997e68c730ade5197fa2c2fca98f315e8299bf06cb883654bd88200921782`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTQsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjk0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MTY0ODEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzQxMzYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxODQ0ODI0LCJjb3N0VXNkRXN0aW1hdGUiOjAuODMwNDIyOH1dLCJ0dXJucyI6MzgsImR1cmF0aW9uTXMiOjI1Njk0NSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODM1NzE2Nzk5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5246 output_tokens=16501 cache_creation_input_tokens=74136 cache_read_input_tokens=1844824 num_turns=38 -->
