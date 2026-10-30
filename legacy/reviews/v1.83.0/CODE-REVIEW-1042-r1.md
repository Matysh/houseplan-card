# CODE-REVIEW-1042-r1

Issue: #1042 · этап code · заход r1 · блокирующих циклов использовано 0 из 2 (лимит track:show)
Материал: `8a3a0f9d2f742e796ab07876b16043d3a7b4e99d` (рабочая копия на нём, `origin/dev..HEAD` = 1 коммит)
Трек: show (владельцем подтверждён)
Маршрут побочных находок: mode=issues (снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`)

## Скоуп

Задача инфраструктурная (класс B): обновляет четыре browser-смока
(`smoke_dialog_polish_605`, `smoke_general_settings_form`,
`smoke_room_appearance`, `smoke_room_dimming_removed`) под принятый контракт
#1037 (перенос цветов оформления из общих настроек в настройки пространства,
материализация эффективных `name_color`/`wall_fill`). `src/**` не тронут.
Дополнительно: `docs/release-ledger/v1.82.0/1042.json` (категория `infra`),
`docs/reviews/evidence-1042/acceptance.md` (авторские доказательства).

Единственный коммит `8a3a0f9d2` несёт `Issue: #1042` / `User-Visible: no` —
верно: продукт не меняется, changelog не требуется.

## Как проверялось

Зелёного Validate на этом SHA нет — все гейты прогнаны лично в этой сессии,
на неизменённом `src/` (bundle:sync без `--release`, комитченный бандл не
трогался):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без ошибок |
| Юнит-тесты | `node --test test/*.test.mjs` (через `npm test`) | PASS — 5590/5591, 1 skipped, 0 fail (первый параллельный прогон на машине дал ложные 12 fail из-за гонки двух одновременных `node --test`; чистый одиночный повтор — 0 fail) |
| Сборка | `npm run build` | PASS, `dist` создан за ~50–60 с |
| Бандл | `node scripts/bundle-policy.mjs --verify` | PASS — «свежая сборка dist цела… закоммиченная копия не сверяется» (бандл меняет только кандидат, #657; здесь и не должен меняться) |
| `smoke-select.mjs --base origin/dev --head HEAD` | — | «Исполняемого frontend-диффа нет»: browser-smoke диффом не выбираются, т.к. `src/**` не тронут — ожидаемо, не разрешение пропустить проверки |
| `node demo/smoke_dialog_polish_605.mjs` | bundle:sync + Chromium 151.0.7922.34 (пин) | PASS, все проверки true |
| `node demo/smoke_general_settings_form.mjs` | то же | PASS, все проверки true |
| `node demo/smoke_room_appearance.mjs` | то же | PASS, все проверки true |
| `node demo/smoke_room_dimming_removed.mjs` | то же | PASS, 28 проверок |

Смоки прогнаны, потому что тело issue прямо называет их («Все три названных
смока проходят на актуальном продукте без правок `src/`» + `smoke_room_appearance`
в risky-hunks списке пакета) — это тот случай, когда Chromium требуется (#696).

Каждое новое/изменённое утверждение в диффе сверено построчно с текущим
`src/` (не только исполнением): `data-field="gs-bg-color"`/`"gs-glow-color"`
(`src/editors/general-settings-dialog.ts:168,191`), `data-field="space-wall-fill"`
(`src/editors/space-form.ts:311`, `id('wall-fill')` → `${idPrefix}-wall-fill`),
`flatSwatch`/`coverSwatch`/`.trigger`/`.swatch` на `hp-color-opacity`
(`src/hp-color-opacity.ts:45,50,58,969,981`), число оставшихся `.hpf-hex`
(`colorField`/`tile` оба рендерят `.hpf-hex` — `src/editors/form-kit.ts:349,393`
— 8 плиток заливки + 2 плашки = 10, было 11 с ушедшей стеновой), структура
`plan`/`sun` карточек в `general-settings-dialog.ts:140-200` (поле `gs-bg-color`
вне `.hpf-colorrow`, `gs-glow-color` внутри `colorRow`).

Не проверялось намеренно (вне объёма гейта ревью на show, инфраструктурная
задача без правки geometry/Python/perf): `golden:verify` (нет `ci:golden`,
визуальный путь плана не затронут), `pytest tests_backend` (Python не
тронут), `npm run invariants` (геометрия не тронута), performance (не назван
в AC), полный `gate:small`/`process-gate` (автор уже привёл их результаты в
хендоффе; не гейт ревью). Ручная dev/GPU-приёмка не запрашивалась и не
является находкой её отсутствия.

## Находки

### Medium (в скоупе) — «эффективные legacy-цвета» в `smoke_room_dimming_removed.mjs` доказаны не тем, чем заявлено

**Файл:** `demo/smoke_room_dimming_removed.mjs:32-33` (фикстура) и `:177-182`
(утверждение); дублируется в `docs/reviews/evidence-1042/acceptance.md`
(«explicit legacy fixture colours become exactly the expected `name_color`
and `wall_fill` on Save») и в коде-комментарии диффа («#1037 freezes the
effective legacy colours… with only those two expected appearance fields from
the explicit fixture above materialized»).

Диффа добавляет в общие настройки конфигурации несуществующее поле
`settings.border_color: { c: '#55606c', a: .8 }` и ожидает, что после явного
Save в `saved.spaces[0].settings.name_color` окажется ровно это значение.
Но `border_color` не читается НИГДЕ в продукте — ни во фронтенде
(`grep -rn "border_color" src/*.ts src/editors/*.ts` даёт единственное
совпадение: ключ i18n-подсказки `'space.border_color.help'` в
`src/editors/space-form.ts:312`, не связанный с конфигом), ни в бэкенде
(`find custom_components/houseplan -name '*.py' | xargs grep -l border_color`
— пусто). Проверено чтением, не исполнением — статический факт, дополнительно
подтверждён git-историей (`git log -S"border_color" -- src/` — единственный
хит тот же i18n-ключ, глобальное поле `border_color` никогда не существовало).

Реальный путь материализации `name_color` — `spaceAppearanceOf()`
(`src/room-appearance.ts:21-31`): он читает `settings.room_color` /
`settings.room_opacity` САМОГО пространства/комнаты, а не какое-либо
глобальное поле. В фикстуре `room_color`/`room_opacity` не заданы вовсе
(`demo/smoke_room_dimming_removed.mjs:24-26` — `settings` пространства
содержит только `fill_mode`/`glow_enabled`/`show_borders`/`show_names`).
Поэтому ожидаемое `{c:'#55606c',a:.8}` получается из жёстко вшитых в
`spaceAppearanceOf` дефолтов (`'#55606c'`, `opacity ?? 0.55`, `+0.25`), что
побайтово совпадает с отдельно экспортируемой константой
`DEFAULT_NAME_COLOR` (`src/room-appearance.ts:6`) — чистое совпадение
дефолтов, а не эффект добавленной фикстуры.

Для `wall_fill` канал материализации настоящий (`general.fill_colors.wall_fill`
действительно читается в `spaceAppearanceOf:28`), но выбранное фикстурой
значение `{ c: '#ffffff', a: 1 }` (`demo/smoke_room_dimming_removed.mjs:33`)
опять-таки побайтово совпадает с `DEFAULT_WALL_FILL`/`DEFAULT_FILL_COLORS.wall_fill`
(`src/logic.ts:1472`, `src/room-appearance.ts:5`). Мутант, который убрал бы
чтение `general.fill_colors.wall_fill` и всегда возвращал дефолт, тоже прошёл
бы этот тест незамеченным.

**Чем краснеет (ожидалось, но не так):** AC этой задачи — защитный
(«проверяет ожидаемые эффективные appearance-поля по #1037»), и для него по
правилам ревью нужна строка «AC · чем доказан · чем краснеет» с реальным
негативным свидетелем. Текущая проверка не различает «материализация читает
общие legacy-цвета» от «материализация всегда отдаёт дефолт вне зависимости
от входа» — оба случая дают один и тот же проверяемый результат. Обычный
отрицательный пример: замени в фикстуре `border_color` на любое другое
значение (или удали его) — `saved.spaces[0].settings.name_color` не
изменится, потому что поле нигде не читается; и замени `fill_colors.wall_fill`
на отличное от дефолта значение (например `{c:'#102030',a:.5}`) с таким же
ожиданием в ассерте — только это действительно ловит регресс в
`spaceAppearanceOf`, поскольку этот канал реален.

**Почему это Medium, а не Low:** это именно тот AC из тела issue
(«Dimming smoke проверяет ожидаемые эффективные appearance-поля по #1037»),
ради которого писалась правка этого файла — его защитное назначение не
выполнено, а сопроводительный текст (комментарий в коде и
`evidence-1042/acceptance.md`) фактически неверно описывает, что именно
доказано. Это «невыполненный AC» по критерию трека show (REVIEWER.md,
«Трек show»), в скоупе текущей задачи.

**Как исправить (не мной — автору):** либо убрать `border_color` из фикстуры
как не относящееся к делу и строить ожидание `name_color` по формуле
`spaceAppearanceOf` явно из `room_color`/`room_opacity` пространства с
отличным от дефолта значением, либо задать `room_color`/`room_opacity`
пространства нестандартными и ожидать соответствующий `name_color`; для
`wall_fill` — взять нестандартное (не совпадающее с `DEFAULT_WALL_FILL`)
значение `fill_colors.wall_fill`, чтобы тест ловил и регресс чтения общего
поля, и регресс дефолта по отдельности.

## Что проверено и корректно

- Перенос `wall_fill`-плашки из общих настроек в настройки пространства
  отражён во всех четырёх смоках согласованно: отсутствие `.hpf-colorrow
  .hpf-colorfield` в `plan`-карточке, ровно одна оставшаяся плашка
  (`gs-bg-color`) там же, ровно две плашки (`gs-bg-color` + `gs-glow-color`)
  во всём диалоге, 10 (было 11) hex-меток — все числа сверены с реальной
  разметкой `general-settings-dialog.ts` и исполнением смоков.
- Событие `hp-color-opacity-change` на `gs-glow-color` адресуется именно
  `colors.glow_light` и не трогает `colors.wall_fill` (изоляция соседних
  ключей) — проверено и чтением источника (`_setFillColor('glow_light', …)`),
  и исполнением.
- Непрозрачная 40px стеновая плашка на новом месте (`space-wall-fill` в
  диалоге пространства) проверена по `flatSwatch`/`coverSwatch`/computed
  `opacity`/`backgroundImage`/геометрии триггера — поле и атрибуты реальны,
  исполнение PASS.
- `smoke_room_dimming_removed`: отсутствие retired darkness (пиксели, роли),
  строгое сравнение остального конфига, единственная явная запись при Save,
  откат черновика при Cancel — все сохранены без ослабления.
- `docs/release-ledger/v1.82.0/1042.json`: категория `infra` обоснована
  (только B/C, продукт не меняется), без `introducedBy` (не требуется для
  `infra`), `baseStable: v1.82.0` соответствует телу issue — инфраструктурные
  задачи не входят в пользовательский milestone релиза, классификация верна.
- Трейлеры коммита корректны (`Issue: #1042`, `User-Visible: no`); не требуют
  правки changelog.
- `smoke-select.mjs` подтверждает: `src/**` не тронут, фронтенд-дифф
  отсутствует — browser-smoke нельзя было бы выбрать автоматически, их
  прогон обоснован прямым упоминанием в теле issue, а не гейтом по умолчанию.

## Чего не проверял

- `golden:verify` — не запускал: нет метки `ci:golden`, зрительный путь
  отрисовки плана не затронут (только test-файлы и JSON/MD).
- `pytest tests_backend` — не запускал: Python не тронут.
- `npm run invariants` — не запускал: геометрия модели не тронута.
- Performance-гейты — не запускал: не названы в AC, диффа в рендере нет.
- Полный `gate:small` / `process-gate.mjs --issues` / полный CI на точном SHA
  — не повторял; автор привёл их результаты в хендоффе (PASS), но зелёного
  Validate на этом SHA инструмент ревью не нашёл, поэтому все дешёвые гейты
  (typecheck/test/build/bundle) и четыре названных смока я прогнал сам лично,
  именно их результаты выше — авторитетны для вердикта.
- Ручная dev/GPU-приёмка владельцем — не проводилась и не требуется для
  вердикта (REVIEWER.md, «Позиция ревьюера»).
- CI-прогон, на который ссылается автор
  (`actions/runs/39916713614`/`39916713467`) — не проверял через API
  (разрешение на `mcp__github__get_workflow_run` не выдано в этой сессии);
  не требовалось, так как материал проверен исполнением гейтов напрямую на
  точном SHA.

## Вердикт

Один находка Medium в скоупе, без High → жёлтый вердикт, возврат автору,
отдельный issue не заводится (mode=issues касается только находок вне
скоупа, которых здесь нет). Маршрут: `fix` — задача целиком укладывается в
критерии §5 трека show (сложность низкая, одна поверхность — набор демо-смоков,
без миграции конфига, без нового UX-контракта, без влияния на
производительность/touch, ожидаемое поведение уже зафиксировано принятым
#1037 и `src/room-appearance.ts`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1042-appearance-smokes`, коммит `8a3a0f9d2f74` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `21d64f2071b5bd8f2038c8401522dce9465b04c7`
  ```
  git log --all --format='%H %T' | grep 21d64f2071b5
  ```
- Тело issue: `21e997e68c730ade5197fa2c2fca98f315e8299bf06cb883654bd88200921782`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMzYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTI1OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTcyLCJvdXRwdXRfdG9rZW5zIjo0MDA5MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMzM3MDQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4MTQ0MTY0LCJjb3N0VXNkRXN0aW1hdGUiOjIuNTY0OTAyNzk5OTk5OTk5fV0sInR1cm5zIjo5OCwiZHVyYXRpb25NcyI6MTA3MDM4MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNTcwMDI4Nzk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5208 output_tokens=40109 cache_creation_input_tokens=133704 cache_read_input_tokens=8144164 num_turns=98 -->
