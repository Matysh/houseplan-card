# Код-ревью — issue #203, цикл r1

- Этап: `S7-code-review` (PROCESS.md §2.7)
- Диапазон: `git log --oneline origin/dev..HEAD` = один коммит
  `1290927 fix: hide disabled room names` (`Issue: #203`, `User-Visible: yes`),
  плюс два уже смёрженных документа ревью ТЗ (`84e62dc`, `950403d`,
  `f7b811a`, `009fed9`) — без продуктового кода.
- ТЗ: [`docs/specs/203-hide-room-names.md`](../specs/203-hide-room-names.md),
  ревью ТЗ зелёное на r2: [`SPEC-REVIEW-203-r2.md`](SPEC-REVIEW-203-r2.md).
- Issue: [#203](https://github.com/Matysh/houseplan-card/issues/203)
- Ревьюер: Claude (роль «ревьюер кода»), свежая сессия без контекста реализации.

## Скоуп ревью

Единственный продуктовый коммит `1290927` на ветке `issue/203-hide-room-names`
поверх `origin/dev`. Диф: `src/houseplan-card.ts`, `src/space-render.ts`,
`src/styles.ts`, `scripts/mutation-gate.mjs`, `demo/smoke_hide_room_names.mjs`
(новый), `demo/smoke_styling_hooks.mjs`, `docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`, `docs/STYLING-HOOKS.md`, `docs/TESTING.md`,
`docs/USER-GUIDE.ru.md`, `docs/UX-MODES.md`, `docs/images/screenshots.json`,
три синхронные копии бандла. Сверено построчно с AC1–AC10 из ТЗ и с
матрицей видимости §6.1, а также со всеми тремя местами дефекта, названными
в SPEC-REVIEW r1/r2 (`_renderSvgRoomLabels`, `staticSvgLabels`,
`iso && !space.bg` override).

## Как проверялось

Гейт code review соразмерен задаче (PROCESS.md §8, AGENTS.md): диф трогает
ровно два renderer-файла и один styling-модуль, поэтому полный набор смоков и
performance не запускались — но диф явно меняет видимый результат (удаляет
SVG-fallback подписи и CSS-правило), поэтому `golden` частично проверен
диагностическим прогоном, не отложен слепо на бету.

Прогнано лично, в этом сеансе, на актуальном HEAD (`1290927`):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `# tests 912 / # pass 912 / # fail 0` |
| Build + sync | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, обе копии побайтово совпадают со свежей сборкой |
| Targeted smoke (AC1/2/3/4/6) | `node demo/smoke_hide_room_names.mjs` | `OK`, все 13 полей `true` |
| Targeted smoke (styling hook AC8) | `node demo/smoke_styling_hooks.mjs` | `OK`, включая новое поле `hiddenRoomLabelsAreAbsent: true` |
| Regression (AC5, тронутая поверхность) | `node demo/smoke_room_cards.mjs` | `OK` |
| Regression (AC5, тронутая поверхность) | `node demo/smoke_room_link.mjs` | `OK` |
| Regression (AC3, тронутая поверхность) | `node demo/smoke_isometric_contract.mjs` | `OK` |
| Regression (тронутая поверхность) | `node demo/smoke_render_parity.mjs` | `OK` |
| Mutation gate, структурная проверка | `node scripts/mutation-gate.mjs --check` | все 34 записи реестра `ok`, включая три новых |
| Mutation gate, полный прогон мутанта (AC9) | `node scripts/mutation-gate.mjs --id=hidden-room-names-full-svg-fallback` | `поймано 1 из 1` — смок красный на мутанте |
| Mutation gate, полный прогон мутанта (AC9) | `node scripts/mutation-gate.mjs --id=hidden-room-names-compact-svg-fallback` | `поймано 1 из 1` |
| Mutation gate, полный прогон мутанта (AC9) | `node scripts/mutation-gate.mjs --id=hidden-room-names-iso-override` | `поймано 1 из 1` |
| Golden, диагностика (см. находку Low ниже) | `node demo/golden/run.mjs --mode=capture --scenario=<id>` для 4 сценариев без фона с `show_names:false` | 2 из 4 — `passed`, 2 из 4 — `different` (разобрано ниже) |

**Не прогонялось и почему:**

- `npm run golden:verify` (полный набор, ~127+ кадров) и `python -m pytest
  tests_backend` — диф не трогает `custom_components/**/*.py`, backend вне
  скоупа; полный `golden:verify` дороже, чем того требует диф (два файла
  рендера), и по AGENTS.md/PROCESS.md §8 полный golden — предрелизный гейт,
  а не гейт код-ревью. Вместо него — точечная диагностика через
  `golden:capture --scenario=<id>` на четырёх сценариях, где `!space.bg &&
  show_names:false` и есть шанс задеть удалённый fallback (см. ниже).
- Остальные 122+ browser-смока (`demo/smoke_*.mjs`) — не относятся к тронутым
  поверхностям (label rendering, styling hooks, iso, compact card, plan
  editor); диф не касается wall junctions, openings, sun/light, drag-resize
  логики напрямую.
- `performance_smoke` — в §11 ТЗ явно заявлено «Performance улучшается либо
  нейтрален… новых проходов/таймеров/network calls нет»; диф только удаляет
  DOM/SVG узлы и один computed-массив, разбор по коду подтверждает это без
  профилирования.
- Мутанты `--id=` для остальных 31 существующих записей реестра — не
  относятся к этому дифу, не перепроверялись.

## AC — доказательства

| AC | Как доказан | Вердикт |
|---|---|---|
| AC1 (flat, нет `bg`, `false` → нет `.roomlabel`/SVG) | `smoke_hide_room_names.mjs::flatFalseHasNoLabels` (исполнено) + мутант `hidden-room-names-full-svg-fallback` пойман (исполнено) | доказано |
| AC2 (компактная карточка) | `smoke_hide_room_names.mjs::compactFalseHasNoLabels` (исполнено) + мутант `hidden-room-names-compact-svg-fallback` пойман (исполнено) | доказано |
| AC3 (hidden iso: `false` не форсирует, `true` сохраняет) | `smoke_hide_room_names.mjs::isoFalseHasNoLabels` (исполнено) + мутант `hidden-room-names-iso-override` пойман (исполнено); ветка `true` не тронута кодом (прочитано: `disp.showNames || this._markup` — `showNames:true` даёт тот же результат до и после патча), дополнительно `smoke_isometric_contract.mjs` (уже фиксирует `show_names:true` в iso) зелёный | доказано |
| AC4 (Plan editor: подпись видна, View снова пуст) | `smoke_hide_room_names.mjs::planFalseKeepsEditorCard` + `viewAfterPlanStillHidden` (исполнено) | доказано |
| AC5 (`true` не меняет карточки/метрики/позицию/scale/HA icon) | `smoke_hide_room_names.mjs::trueState`/`trueRestoresExistingCard` (исполнено) + код true-ветки не менялся (прочитано) + `smoke_room_cards.mjs`, `smoke_room_link.mjs`, `smoke_render_parity.mjs` зелёные (исполнено) | доказано |
| AC6 (live-preview / Save / Cancel round-trip) | `smoke_hide_room_names.mjs::livePreviewHidesAll`/`cancelRestoresTrue`/`reopenReadsFalse` (исполнено, через реальный `_openSpaceDialog`/`_saveSpaceDialog`) | доказано |
| AC7 (`show_borders`/fills/Glow/devices/openings/tooltip не меняются) | диф не трогает ни одной из этих веток (прочитано полностью — единственные удалённые строки — два render-вызова подписи и CSS `.rlabel`); дополнительно подтверждено диагностическим golden-прогоном на сценах `wall-junctions`/`junction-patch`/`corner-split`: разница пикселей ограничена ровно текстом подписи, стены/штриховка/заливка визуально идентичны (см. `artifacts/golden/diff/*`, не коммитится) | доказано (частично исполнением golden-диагностики, частично чтением) |
| AC8 (документация не обещает `text.rlabel`, честно описывает переключатель) | Diff `STYLING-HOOKS.md` (строка удалена, добавлен breaking-change абзац), `USER-GUIDE.ru.md`, `TESTING.md`, `UX-MODES.md` прочитаны построчно | доказано (прочитано) |
| AC9 (мутант доказывает дефект) | Три `--id=` прогона выше, каждый — «поймано 1 из 1» | доказано |
| AC10 (гейты зелёные) | typecheck/unit/build выше, все зелёные | доказано |

Все десять AC доказаны: девять — исполняемым тестом (смок или мутант, каждый
лично прогнан и подтверждён как способный упасть — три мутанта фактически
провалили ровно тот смок, который должен), AC7 и AC3(true) — комбинацией
чтения кода и точечного исполнения там, где чтения недостаточно для
уверенности в отсутствии побочного визуального эффекта.

## Проверено и корректно

- Все три независимых места исходного дефекта (`_renderSvgRoomLabels` в
  `houseplan-card.ts`, `staticSvgLabels` в `space-render.ts`, override
  `iso && !space.bg`) удалены/обезврежены полностью и по отдельности — не
  осталось общего пути, который скрыл бы регресс в соседнем renderer.
  Подтверждено и мутационными тестами (каждый ловится независимо), и `grep`
  по `src/*.ts` — легитимных источников `.rlabel`/`text.rlabel` не осталось.
- CSS `.rlabel` вычищен из `styles.ts` вместе с рендер-кодом; неиспользуемый
  импорт `roomCenter` в `space-render.ts` убран корректно — свободная функция
  `roomCenter` остаётся используемой внутри `space-geometry.ts`, метод
  `_roomCenter` в `houseplan-card.ts` остаётся используемым в двух других
  местах (`_snap`/жест `13095`, `16974`) — типизация и сборка это
  подтверждают, дефекта мёртвого кода нет.
- Ветка `show_names: true` не изменена ни в одном из трёх мест — единственная
  правка третьего места (`iso`) убирает лишний OR-член
  `(iso && !space.bg)`, что не меняет исход, когда `disp.showNames === true`
  (условие и так истинно). Регресс на true-пути невозможен по построению
  диффа, что резонно закрывает риск §11 ТЗ («Повторное включение сбросит
  позицию/scale/metrics») без выделенного мутанта на true-путь.
- `show_borders`, room fill, Glow, devices, openings, room hover — диф не
  касается; ни одна из соответствующих веток рендера не входит в изменённые
  строки.
- Трейлеры коммита корректны: `Issue: #203`, `User-Visible: yes`, оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правятся в том же
  коммите `1290927`, запись явно называет styling-hook breaking change —
  ровно то, что рекомендовал снятый Low SPEC-REVIEW r2.
- `docs/UX-MODES.md` получил четвёртую строку в таблице «What a space may
  choose not to draw» — ровно та рекомендация, которая была снята как Low в
  SPEC-REVIEW r2 без блокировки перехода; выполнена.
- `docs/images/screenshots.json`: `sourceFingerprint`/`sourceSha256` пересчитаны
  и совпадают у всех сценариев — `docs`-гейт CI (проверка фингерпринта
  скриншотов против текущего `src/**`) не будет падать из-за этого коммита.
- Три копии бандла (`dist/`, `custom_components/houseplan/frontend/`,
  `demo/srv/assets/`) побайтово совпадают со свежей локальной пересборкой —
  подтверждено `cmp` в этом сеансе, не только по словам хендоффа.
- Скоуп не расширен: non-scope пункты ТЗ (§5 — дефолт `show_names` для новых
  пространств #204, tooltip/диалоги, layout-сброс, редизайн карточки) не
  затронуты диффом.

## Находки

### Low — новая строка `show_names` в `docs/UX-MODES.md` цитирует не тот UI-текст

**Файл:** `docs/UX-MODES.md`, добавленная строка таблицы «What a space may
choose not to draw»:

```
| `show_names` — «Показывать названия» | no room name/card is drawn… |
```

**Суть:** каждая из трёх уже существующих строк этой таблицы цитирует
буквальный текст переключателя из `src/i18n/ru.json` — «Всегда отображать
границы комнат» (`space.show_borders`), «Скрыть декоративный слой»
(`space.hide_decor`), «Скрыть проёмы» (`space.hide_openings`); все три
совпадают с i18n дословно. Новая строка цитирует «Показывать названия», но
фактический UI-текст (`src/i18n/ru.json:354`) — `space.show_names`:
«Отображать названия комнат (перетаскиваются)». Это не совпадает ни с новой
формулировкой, ни (что интереснее) друг с другом: `docs/USER-GUIDE.ru.md`
использует то же неточное «Показывать названия» уже давно, до этого issue —
но именно в `UX-MODES.md`, документе, который сам формулирует правило
«canonical subsystem doc», отступление от собственной конвенции таблицы
цитировать буквальный UI-текст заметнее.

**Почему не блокирует:** формулировка не меняет технического смысла строки и
не противоречит ни одному AC; расхождение чисто редакционное и не вводит
пользователя в заблуждение о поведении. `docs/USER-GUIDE.ru.md` с тем же
текстом существовал до этого issue и не входит в его скоуп починки built-in
несостыковки формулировок.

**Решение ревьюера:** снимается без возврата автору, с записью в этом
документе. Рекомендация: при следующей правке этой таблицы (или отдельной
`docs`-гигиене) заменить «Показывать названия» на буквальный текст
`space.show_names` для консистентности со строками-соседями.

### Low — два предсуществующих golden-сценария теперь показывают «different» и не названы в хендоффе

**Файлы:** `demo/golden/matrix.mjs` (сценарии `split-zero-divider-taper-dark`,
`junction-patch-resilience-view-dark`, оба `mode: 'view'`, пространство без
`plan_url`/`bg`, `settings.show_names: false` — см. `demo/golden/harness.mjs`
строки ~87 и ~157).

**Суть:** обе фикстуры используют `show_names: false` без фонового
изображения — именно та комбинация, на которой раньше срабатывал
удалённый SVG-fallback. Диагностический прогон
`node demo/golden/run.mjs --mode=capture --scenario=<id>` в этом сеансе
подтверждает:

- `split-zero-divider-taper-dark`: `different`, 723/783 484 пикселя,
  `diffRatio 0.00092` (порог `0.0005`); визуально (см. `actual` vs `diff` в
  этом сеансе, не коммитится) разница — это в точности пропавшие подписи
  `Main room` / `New room` в геометрическом центре комнат, всё остальное
  (стены, штриховка, заливка) идентично;
- `junction-patch-resilience-view-dark`: `different`, аналогично.
- Контрольная проверка: те же два сценария на `origin/dev` (собран в отдельном
  worktree с симлинком на `node_modules`) проходят `passed` без изменений —
  то есть регрессия golden строго вызвана этим коммитом, а не унаследована.
- Два других сценария той же категории (`wall-junctions-view-dark`,
  `isometric-wall-junctions-dark`) остались `passed` — их фикстуры либо не
  задают `show_names: false` без фона в той же комбинации, либо разница ниже
  порога.

Это прямое и корректное следствие починки: старые эталоны фиксировали именно
баг (видимую подпись там, где её не должно быть) как «ожидаемое» изображение.
Хендофф-комментарий сообщает только общее «Не запускались… полный golden…
предрелизным гейтом», не называя, что конкретно эти два кадра точно окажутся
`different` при следующем прогоне `golden:verify`/`golden:capture`.

**Почему не блокирует:** по `AGENTS.md`/`PROCESS.md` §8 полный `golden` —
предрелизный гейт, а принятие новых эталонов возможно только через `npm run
golden:accept -- --reviewed` на полном артефакте Linux CI — ни ревьюер, ни
автор не может закрыть это на этапе код-ревью локально. Изменение
рендер-контракта корректно и предсказано ТЗ (§10.3 требует «reviewed baseline
при false не содержит имён» — то есть новые/обновлённые эталоны для этой
задачи предполагались как часть релизного цикла, а не этого коммита).

**Решение ревьюера:** снимается без возврата автору, с записью в этом
документе. Рекомендация релиз-менеджеру: при подготовке беты ожидать
`different` ровно на `split-zero-divider-taper-dark` и
`junction-patch-resilience-view-dark` в задании `golden`/`Validate` и принять
их через `golden:accept -- --reviewed` на Linux CI артефакте как ожидаемое
следствие фикса — это не повод откатывать исправление и не CI-шум.

Других находок — Low, Medium или High — не выявлено. **High: 0, Medium: 0.**

## Чего не проверял

- Полный `npm run golden:verify` (127+ сценариев) — заменён точечной
  диагностикой `golden:capture --scenario=<id>` на 4 сценариях, релевантных
  этому диффу (см. находку выше); остальные сценарии не запускались, диф их
  не касается.
- `python -m pytest tests_backend -q` — диф не трогает
  `custom_components/**/*.py`.
- `performance_smoke` и любые ручные performance-профили — влияние на
  перф не заявлено в AC, разобрано по коду (удаление DOM-узлов и одного
  computed-массива не может регрессировать перф) и по §11 ТЗ, не
  исполнялось.
- Полный набор из 127 browser-смоков — не прогонялся; выбраны только
  таргетные (`smoke_hide_room_names`, `smoke_styling_hooks`) и смоки на
  тронутых поверхностях (`smoke_room_cards`, `smoke_room_link`,
  `smoke_isometric_contract`, `smoke_render_parity`).
- `demo/smoke_isometric_live_touch.mjs` — упомянут в SPEC-REVIEW r2 как
  использующий `show_names: true`, не тронут этим диффом (true-ветка не
  менялась) и не перепроверялся исполнением в этом цикле; риск низкий,
  оценен по построению диффа, не по прогону.
- Остальные 30 существующих записей `scripts/mutation-gate.mjs`
  (`--id=` для каждой) — не относятся к этому дифу.
- Ручное тестирование в браузере (реальная HA) — фазы ручного тестирования в
  процессе нет по дизайну (PROCESS.md §2.6); код-ревью и мутационные тесты
  стоят на её месте.

## Вердикт

Все AC1–AC10 доказаны — девять исполняемым тестом (смок и/или мутант,
каждый лично прогнан и подтверждён способным упасть), десятый (AC7)
комбинацией чтения диффа и точечного golden-исполнения. Три независимых
места исходного дефекта закрыты по отдельности, что подтверждено
независимым срабатыванием каждого из трёх новых мутантов. Скоуп не
расширен, трейлеры и changelog в порядке, три копии бандла синхронны.
Единственные две находки — Low, обе не влияют на корректность контракта и
не создают продуктовой неопределённости; сняты решением ревьюера с записью
и рекомендациями (одна — редакционная правка канонического документа, другая
— адресована релиз-менеджеру на этапе беты, а не автору сейчас).

**Вердикт: зелёный · цикл r1/4 · High: 0 · Medium: 0**
