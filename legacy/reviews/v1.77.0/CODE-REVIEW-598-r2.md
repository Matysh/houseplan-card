# CODE-REVIEW-598-r2

Issue: #598 · Заход r2 · Материал: `b9f8922bf57816f962c3e6a112a6dfb4fb0214ed` (HEAD, рабочая копия на нём же, `git status` чист)

## Скоуп

r1 (материал `c22a1f43`) закрылся красным с четырьмя находками: H1
(эталоны AC8 не переснимались и `golden:verify` красный на предъявленном SHA),
M1 (правка неприкосновенного `demo/smoke_tap_run.mjs`), M2 (сегмент обещан в
семи местах ТЗ, сделан в одном, мёртвый импорт `segmented` в
`space-settings-dialog.ts`), M3 (мутант `state-callout-hidden-under-help`
патчит только половину защищённого AC5), плюс некритичный L1 (AC1 для
«Пространства» без выделенного теста, закрыто чтением).

Дельта r1→r2 — три коммита, все по делу, ни один не расширяет скоуп ТЗ:

| Коммит | Что делает |
|---|---|
| `bd6da53f` | восстанавливает `smoke_tap_run.mjs` побайтово к `origin/dev`, заводит `demo/smoke_settings_dialog_cards.mjs`, переводит `space-bg-mode`/`space-zero-wall-style` в `segmented`, добавляет `ensureFormKitStyles(this.host)` в три диалога, второй патч мутанта |
| `acf179e4` | отпечаток скриншотов документации (`docs/images/screenshots.json`), без кода |
| `b9f8922b` | одиннадцать golden-эталонов трёх диалогов, объявленных в AC8 |

`git diff --stat c22a1f43..HEAD` (без `dist/`, `custom_components/frontend`,
`demo/golden/baselines`): `general-settings-dialog.ts` (+3/-2 — только
`ensureFormKitStyles`), `marker-dialog.ts` (то же), `space-settings-dialog.ts`
(45 строк — два `<select>` → `segmented`), `smoke_settings_dialog_cards.mjs`
(новый, 81 строка), `smoke_tap_run.mjs` (−22, откат), `scripts/mutation-registry.mjs`
(второй патч мутанта), два changelog, отпечаток скриншотов. Больше ничего в
продуктовом коде не менялось — раунд разбирался по этой дельте, а не заново.

## Как проверялось

Дешёвые гейты подтверждены на этом SHA внешним источником — Validate
[35460245027](https://github.com/Matysh/houseplan-card/actions/runs/35460245027)
и [35459751977](https://github.com/Matysh/houseplan-card/actions/runs/35459751977),
оба `success` на `b9f8922b` (проверено `gh run view --json headSha,conclusion`).
Смок и golden внутри `35459751977` — не пропуск, а зачёт: job `Golden-кадры
против принятых эталонов: success`, шесть job'ов `Мутанты по диффу`: success.
Но так как это ключевые для AC8/M1-M3 доказательства, я не остановился на
факте «CI зелёный» и прочитал содержимое этих job'ов, а часть перепрогнал сам:

| Гейт | Как проверено | Результат |
|---|---|---|
| AC8 (эталоны) | `gh run view 105941603797 --log` (job `Golden-кадры...` внутри 35459751977) — все 173 сцены `passed`, ни одной `different` | ✅ закрыто; локально `git diff --stat` подтверждает ровно 11 PNG + index в этом же наборе, что назван в AC8 |
| M1 (`smoke_tap_run.mjs` неприкосновенен) | `git diff --quiet origin/dev -- demo/smoke_tap_run.mjs` | ✅ IDENTICAL |
| M1/AC1/AC2/AC5/AC6 (новый смок реален) | прочитан `demo/smoke_settings_dialog_cards.mjs` целиком; выполнен локально `node demo/smoke_settings_dialog_cards.mjs` (после `npm run bundle:sync`, иначе демо-стенд не собран) | ✅ 10/10 проверок `true`, `OK` |
| AC3 (единственный правленый смок — строже, не слабее) | прочитан диф `demo/smoke_general_settings.mjs`; выполнен `node demo/smoke_general_settings.mjs` | ✅ снимает и старый, и новый список заголовков, добавляет `everyCardHasContent`/`sunMissingStaysVisible`/`movedHintsHaveHelp`/`noMovedHintParagraphs`, старая проверка `glowRadiusInsideGlowGroup` ужесточена до `card.contains(row)` |
| M2 (сегменты сделаны, импорт не мёртв) | `git diff c22a1f43..HEAD -- src/editors/space-settings-dialog.ts`; `grep -n segmented` | ✅ два `<select>` → `segmented(...)`, импорт используется дважды |
| M2 (сокращение объявлено) | ТЗ (раздел «Сегментированный переключатель — объявленный объём (r4)») + оба changelog | ✅ причина по каждому из трёх оставленных мест названа поимённо, changelog говорит «three», а не «one» |
| M3 (мутант патчит оба состояния) | `git diff -- scripts/mutation-registry.mjs`; `node scripts/mutation-gate.mjs --id=state-callout-hidden-under-help` локально | ✅ второй `patches`-блок на `gs.sun_missing` в `general-settings-dialog.ts`; локальный прогон — «покраснел на мутанте», поймано 1 из 1 |
| Мутант `dialog-card-loses-its-heading` (AC3/AC4 опора) | `node scripts/mutation-gate.mjs --id=dialog-card-loses-its-heading` | ✅ поймано 1 из 1 |
| Реестр мутантов цел | `node scripts/mutation-gate.mjs --check` | ✅ все якоря, включая 4 из #598, на месте |
| `ensureFormKitStyles` действительно вызван во всех трёх диалогах (найденный автором попутный дефект) | `git diff c22a1f43..HEAD -- src/editors/{general-settings,marker,space-settings}-dialog.ts` | ✅ во всех трёх, до первой строки рендера |
| AC7 (цвет) | `node demo/smoke_color_picker_consumers.mjs` | ✅ зелёный, файл вне диффа |
| `smoke_help_affordance` | `node demo/smoke_help_affordance.mjs` | ✅ зелёный |
| AC2 (девять `.srcrow`-смоков + `smoke_backup_transfer` без правок) | `git diff --stat origin/dev...HEAD -- demo/` | ✅ в списке только `smoke_general_settings.mjs` (правка) и `smoke_settings_dialog_cards.mjs` (новый) — девять протестированных на r1 файлов и `smoke_backup_transfer` в диффе не встречаются вовсе |
| AC9 (панель/комната не задеты) | `git diff --stat origin/dev...HEAD -- src/summary-panel src/editors/room-settings-dialog.ts` | ✅ пусто |
| Typecheck + сборка | `npm run build` (запускает `tsc --noEmit && rollup -c`) | ✅ 0 ошибок, собрано за 19с |
| AC10 (бюджет графа) | `npm run bundle:budget` | ✅ initial View 291530 Б (потолок 292500±2000), lazy editor 222198 Б (потолок 222900±2000) — оба в полосе, только предупреждение о снижающемся запасе (не отказ) |
| `check-docs` (диф трогает `src/**`) | `node scripts/check-docs.mjs` | ✅ «Documentation checks passed (7 files, 12 external links)» |
| Release/версия | `grep version package.json` против трейлера `Release: v1.77.0-beta.1` на `b9f8922b` | ✅ версия в `package.json` та же — коммит не бампает, соответствует пояснению автора |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — AC8 красный на `c22a1f43`, эталоны не переснимались | Эталоны переснята на Linux CI (`acf179e4`), приняты `accept.mjs --reviewed --expect-change=<11 id>`, закоммичены в `b9f8922b` | `git diff --stat` коммита `b9f8922b` — ровно 12 файлов (11 PNG + index); `golden:verify` на `b9f8922b` — 173/173 `passed`, job `Golden-кадры против принятых эталонов: success` в прогоне 35459751977 (проверено чтением лога job'а, не только по статусу) |
| **M1** — `smoke_tap_run.mjs` изменён (22 строки), нарушая AC2/AC3 | Файл возвращён побайтово к `origin/dev`; проверки карточек устройства перенесены в новый `demo/smoke_settings_dialog_cards.mjs` | `git diff origin/dev -- demo/smoke_tap_run.mjs` — пусто; новый файл содержит `missingRunTargetStaysVisible`/аналоги вместо `smoke_tap_run.mjs` |
| **M2** — сегмент обещан в 7 местах, сделан в 1; мёртвый импорт | `space-bg-mode` и `space-zero-wall-style` переведены в `segmented` (вместе с `gs-bg-mode` из r1 — три реальных `<select>`); отказ от оставшихся трёх мест объявлен в ТЗ таблицей с причиной по каждому; импорт используется | `git diff c22a1f43..HEAD -- src/editors/space-settings-dialog.ts` — оба `<select>` заменены; раздел ТЗ «Сегментированный переключатель — объявленный объём (r4)»; `grep segmented` — два вызова |
| **M3** — мутант патчит только `marker.run_target_gone`, не `gs.sun_missing` | Второй `patches`-блок добавлен на `gs.sun_missing` в `general-settings-dialog.ts`, guard переведён на `smoke_settings_dialog_cards.mjs` | `git diff -- scripts/mutation-registry.mjs`; локальный прогон `--id=state-callout-hidden-under-help` — «поймано 1 из 1» |
| **L1** — AC1 для «Пространства» без своего теста (некритично, закрыто чтением) | Добавлен `zeroWallSegmentWritesItsOwnKey` в новом смоке | `demo/smoke_settings_dialog_cards.mjs:70-76`; прогон подтверждает `true` |

Все пять пунктов закрыты по существу и подтверждены исполнением (не только
заявлением автора), включая случай, где заявление автора («смоки переиспользованы
через #573») стоило проверить отдельно (см. ниже).

## Отдельно: заявление о переиспользовании смоков — проверено, не просто принято на слово

Автор написал: «смоки и перф-смок на `b9f8922b` пропущены переиспользованием
(#573): продуктовое дерево не менялось с `acf179e4`». Job-лист самого
`b9f8922b` действительно показывает `Смоки в браузере: skipped`. Это стоило
проверить отдельно, потому что `b9f8922b` — не первый коммит с новым смоком:
физически новый файл `demo/smoke_settings_dialog_cards.mjs` появился в
`bd6da53f`, и push-прогон именно этого коммита (`35454485142`) тоже показывает
`skipped`, а его собственный `workflow_dispatch` (`35454607737`) — `cancelled`.
То есть ни на одном "push"-прогоне смоки реально не исполнялись.

Разобрал механизм: `scripts/gate-reuse.mjs` считает контент-хэш для
`smoke`/`golden`/`performance_smoke`/... и сверяет с кэшем `actions/cache` по
ключу `reuse-<job>-<hash>`. Для `bd6da53f` кэш смока — **промах** (`Cache not
found`), то есть реюз не сработал и `smoke=false` (должен был выполниться);
job тем не менее в списке `skipped` — это особенность лёгкого `push`-воркфлоу,
который не гоняет тяжёлые job вовсе (они только в `workflow_dispatch`). Реальный
запуск с реальными смоками случился на `workflow_dispatch` коммита `acf179e4`
(`35454723038`, единственная разница с `bd6da53f` — отпечаток скриншотов, не
код): там все три шарда смоков — `success`, включая явную строку `ok
smoke_settings_dialog_cards` (шард 1), `ok smoke_tap_run` (шард 3), `ok
smoke_help_affordance`/`smoke_color_picker_consumers` (шард 2), и оба мутанта
задачи — `state-callout-hidden-under-help`/`dialog-card-loses-its-heading` —
пойманы в шарде 5. У `b9f8922b` контент-хэш смока (`3af6afc4de77...`) **тот
же**, что у `acf179e4`, поэтому реюз для `b9f8922b` легитимен: он ссылается на
реально исполненный и зелёный прогон, а не на пропуск по цепочке пропусков.

Я также перепрогнал сам, локально, без доверия к CI: `smoke_settings_dialog_cards`,
`smoke_tap_run`, `smoke_general_settings`, `smoke_help_affordance`,
`smoke_color_picker_consumers` — все зелёные (после `npm run bundle:sync`,
без которого стенд не собран и смоки падают с `Failed to fetch dynamically
imported module`, что не является дефектом кода — это ожидаемое состояние
чистой рабочей копии до сборки).

## Что проверено и корректно

- **AC1–AC3** — см. таблицу закрытия выше; запись в черновик не менялась ни у
  одного перенесённого контрола (сверено чтением обёрток в `space-settings-dialog.ts`:
  `onChange`-замыкания дословно те же, что были у `@change`).
- **AC5** — оба сообщения о состоянии остаются callout'ами: `sunMissingStaysVisible`
  и `missingRunTargetStaysVisible`/аналог в двух независимых смоках, оба
  мутанта задачи ловятся.
- **AC6** — реализовано ровно то, что называет колонка доказательства самого
  AC6 (`bgSegmentIsRadioGroup`, `bgSegmentTakesFocus`, `bgSegmentTargetIsBigEnough`
  для `gs-bg-mode`) плюс структурный мутант `form-kit-segment-drops-radio-semantics`,
  патчащий общий `form-kit.ts` — он защищает семантику радиогруппы во всех
  потребителях `segmented()` разом, включая два новых в «Пространстве».
  Проверено чтением: `role="radiogroup"` и `aria-label` у обоих новых
  сегментов «Пространства» также сняты смоком (`spaceHasTwoSegments`), а
  44 px не передизайнены отдельно от общего `ensureFormKitStyles` — фикс
  применён на уровне диалога, а не контрола, и это тот же вызов, что уже
  проверен для «Общих». Отдельного покадрового замера высоты для двух
  сегментов «Пространства» смок не делает — риска не вижу: рендер идёт через
  тот же `segmented()` и тот же общий стиль.
- **AC7** — `smoke_color_picker_consumers.mjs` не в диффе, зелёный.
- **AC8** — 11 из 11 названных сцен приняты, ни одной сверх; `golden:verify`
  зелёный целиком.
- **AC9** — `summary-panel-*`/`room-settings-dialog.ts` и их смоки вне диффа.
- **AC10** — initial View и lazy editor в полосе, измерено локальной сборкой.
- **AC11** — подтверждено внешне (Validate success целиком на `b9f8922b`,
  включая `Фронтенд: типы, юниты, мутанты, синхрон бандла`); не перегонял
  весь `npm test` локально (дорого, дешёвые гейты уже подтверждены), но
  `tsc`/`build`/`check-docs`/`bundle:budget`/точечные смоки/мутанты
  перепроверены напрямую.
- Changelog RU+EN правлены в одном коммите с User-Visible-изменением (`bd6da53f`,
  трейлер `User-Visible: yes`); коммиты без пользовательских изменений несут
  `User-Visible: no`.

## Унаследовано из r1

Всё, что r1 (`docs/reviews/CODE-REVIEW-598-r1.md`, материал `c22a1f43`) уже
проверил и не нашёл нарушений, а дельта r1→r2 не касается, принято без
повторной проверки — подтверждено тем, что затронутые r1 файлы/разделы вне
diff'а `c22a1f43..HEAD` (кроме перечисленных выше точечных правок):

- **К1/К3/К4/К6/К8** — построчная сверка всех трёх диалогов на предмет
  сохранения обработчиков, классов-опор, атомарности `hp-color-opacity`,
  переноса `gs.hint` между словарями (`gs.card_fills.help`), потолка ленивого
  графа — раздел «Что проверено и корректно» r1.
- **i18n** — 24 новых ключа/96 строк в четырёх локалях, сверены посимвольно
  против исходных текстов; `gs.hint` удалён из `support/*.json` во всех
  четырёх локалях. Дельта r2 не трогает ни один `i18n/*.json`.
- **Терминология USER-GUIDE**, скоуп/не-скоуп, классы риска §2.6 (кроме
  визуального — там сама находка H1 и была) — r1, раздел «Что проверено и
  корректно», не изменено дельтой.
- **`test/single-source-numbers.test.mjs`** — дельта не вводит новых видимых
  величин (правка UI-разметки и один мутант-патч), правило неприменимо, как и
  установил r1.

## Чего не проверял

- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py`
  ни в дельте, ни всего issue целиком (уже отмечено в r1).
- `node scripts/model-invariants.mjs` / геометрический TS/Python parity — диф
  не трогает геометрию, `layout`, `marker.space`, `open_spans`.
- Perf-профили — не названы в AC, `iso-*`/`live-*`/`render-*` не тронуты.
- Полный `npm test` (2789 тестов) — не перегонял локально; опирался на
  внешнее подтверждение (Validate success на `b9f8922b`, job «Фронтенд: типы,
  юниты, мутанты, синхрон бандла») и на точечные прогоны того, что дельта
  реально касается (мутанты, новые/правленые смоки, `check-docs`,
  `bundle:budget`, `build`).
- Полный набор из 250+ браузерных смоков — дельта не задевает всё; выбор выше
  — прямое совпадение (файлы, названные в AC/находках r1) плюс девять
  `.srcrow`-смоков, для которых уже достаточно `git diff --stat` (пусто) —
  их незачем гонять заново, раз в дереве нет изменений, которые могли бы их
  сломать.
- `smoke-select.mjs` не запускал заново в r2 — набор дельты (2 смока + 1
  новый) меньше и уже точнее того, что мог бы предложить инструмент; выбор
  обоснован построчно в таблице выше.

## Вывод

Все четыре находки r1 (H1, M1, M2, M3) и некритичный L1 закрыты по существу и
подтверждены исполнением — частично внешним (логи CI-job'ов, прочитанные, а
не принятые на веру по статусу), частично прямым локальным прогоном. Новых
High/Medium находок не обнаружено.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/598-three-dialogs-form-kit`, коммит `b9f8922bf578` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `99ac247e8e204792057f906d253a666458369e62`
  ```
  git log --all --format='%H %T' | grep 99ac247e8e20
  ```
- Тело issue: `2a5e390320fdf28accbc1519e2c091a939bbde84ebb73be8093f9c1cbe7c3335`
- Вердикт конвейера: `green` · High 0
