# CODE-REVIEW-476-r2

- **Issue:** #476 — Явное завершение выбора цвета кнопкой «ОК»
- **Этап:** код-ревью (PROCESS.md §2.7), заход r2, блокирующих циклов израсходовано 1 из 4
- **Ветка:** `issue/476-color-picker-ok`, HEAD `6e0e1f8c` (`origin/dev` = `fc5973c2`, ровно merge-base — ветка полностью приведена к `dev`, ребейз чист, конфликтов нет)
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 9 коммитов; материал — `git diff origin/dev...HEAD`, 56 файлов
- **ТЗ:** `docs/specs/476-color-picker-ok.md`, полный трек, ревью ТЗ зелёное на r2 (`docs/reviews/SPEC-REVIEW-476-r2.md`)

## Почему разбор полный, а не по дельте

Между r1 код-ревью (жёлтый, `docs/reviews/CODE-REVIEW-476-r1.md`, доказано на `HEAD b5a1001e`) и этим заходом ветка дважды двигалась:

1. автор устранил M1 и M2 коммитом `test: harden color picker confirmation guards` — локальная правка тестов/реестров, ожидаемый предмет обычной дельты;
2. затем `origin/dev` ушёл вперёд ещё на 5 коммитов, review не запустился («Ревью не запускалось» — конфликт слияния, цикл не израсходован), и автор перебазировал ветку на `fc5973c2`, разрешив конфликт только в сгенерированных `dist/**`/`custom_components/houseplan/frontend/**` (пересобраны из объединённых исходников).

Пункт 2 — ребейз на ушедший вперёд `dev`, что PROCESS.md §2.10/§7.2 прямо называет «другим кодом», обязывающим к полному разбору. Я его сделал: ниже — полная таблица гейтов и AC, а не только диф вокруг M1/M2. Практически это означало не доверять чужому заявлению «конфликтовали только сгенерированные файлы», а проверить самому: `git log --oneline origin/dev..HEAD -- src/hp-color-opacity.ts` показывает **ровно один** коммит (`82f65acd`, реализация, предшествующая r1-ревью) — второй ребейз действительно не тронул продуктовую логику, только сгенерированные бандлы и `docs/images/screenshots.json` (fingerprint). Это подтверждено чтением, а не принято на слово.

## О «SHA не назван» (проверка §2.10, шаг 1)

Комментарий-вердикт r1 в issue (11:47:29Z) сам по себе не называет проверенный SHA — но материал по процессу объявляется не в комментарии, а в блоке «Материал раунда» документа (`CODE-REVIEW-476-r1.md`), и там SHA есть: в прозе документа — `HEAD b5a1001e` (после того как конвейер сам привёл ветку к `dev`, "34a6b276 → b5a1001e"), в машинном блоке — коммит `34a6b276473c` (тот же материал, тег до этого приведения) плюс дерево `94485fdc0eca...`. Отсутствие SHA в комментарии — не находка: PROCESS.md §2.10 явно возлагает эту обязанность на документ, а не на комментарий.

Оба анкера (`34a6b276473c`, `b5a1001e`) сейчас не резолвятся в этом чекауте (`git cat-file -t 94485fdc0eca... ` → `could not get object info`) — это следствие **второго** ребейза (пункт 2 выше), случившегося **после** публикации документа r1 (12:11 против 11:47). На момент публикации r1 материал был жив, что и требуется §2.10; это обычный случай осиротевшего SHA («98 из 804»), не находка. Проверить содержимое напрямую я не мог, поэтому опираюсь на: (а) единственный коммит, трогающий `src/hp-color-opacity.ts`, не менялся между r1 и сейчас (см. выше), (б) построчное сравнение текста файла ниже совпадает с тем, что описывает документ r1.

## Скоуп диффа (полный)

`src/hp-color-opacity.ts` (61 строка, коммит `82f65acd`, не менялся после r1) — полноширинная кнопка «ОК», `_hexNeedsValidInput` защита от обхода невалидного HEX повторным подтверждением, `_confirm()` со `stopPropagation()`. `src/houseplan-card.ts` (1 строка) — `confirm` label. `src/i18n/{en,ru,de,fr}.json` — `color_picker.confirm`. `test/color-picker.test.mjs`, `test/i18n.test.mjs` — юниты на DOM-порядок/CSS/label/i18n-parity. `demo/smoke_color_picker.mjs` (расширен), `demo/smoke_help_affordance.mjs` (fallback-путь), **новый** `demo/smoke_color_picker_consumers.mjs` (M2). `scripts/mutation-gate.mjs` (2 новых мутанта, M1+M2), `scripts/smoke-links.mjs` (реестр выбора смоков). Оба changelog, `docs/TESTING.md`, `docs/specs/README.md`, пересобранные `dist/**`/`custom_components/houseplan/frontend/**`, обновлённый `docs/images/screenshots.json` (только fingerprint). Backend, геометрия, config/storage не затронуты.

## Как проверялось

Зелёного Validate на `6e0e1f8c` нет (`gh run view 34032363066` — `completed/failure`, единственный красный job — `Golden-кадры против принятых эталонов`; `Фронтенд`, `Предполётные проверки`, оба перф/смок-джоба и все 3 шарда браузерных смоков — `success`). Прогнал сам:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | `2077 tests, pass 2076, fail 0, skipped 1` — совпадает с заявленным |
| Build + sync | `npm run build && npm run bundle:sync` | `dist` собран; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `git status --short` пуст после сборки |
| Docs-гейт | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 12 external links)` — обязателен, diff трогает `src/**` |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (59 добавленных строк в 2 файлах — те же, что в r1: делта не добавила новых строк в `.ts`) |
| Process-gate | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (9 коммитов в диапазоне) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение (1): `smoke_color_picker_consumers.mjs` (← `_surface`, новый файл появился в диффе). Зарегистрированная связь (2): `smoke_color_picker.mjs`, `smoke_help_affordance.mjs`. Слабая связь (15, `stopPropagation`) — те же имена, что и в r1 (`smoke_cover_*`, `smoke_decor`, `smoke_edit_walk`, `smoke_editor_gestures`, `smoke_furniture`, `smoke_hide_layers`, `smoke_inert_openings`, `smoke_modes`, `smoke_room_cards`, `smoke_space_settings`, `smoke_tap_ctx`, `smoke_tap_run`, `smoke_toggle_confirmation`, `smoke_value_face_source`) — просмотрел список повторно, все про другие поверхности; не гонял |
| Целевой смок 1 | `node demo/smoke_color_picker.mjs` | `OK`, все 21 поле `true`, включая `repeatedConfirmCannotBypassInvalidHex: true` |
| Целевой смок 2 (новый) | `node demo/smoke_color_picker_consumers.mjs` | `OK`, все 13 полей `true`, включая `generalConfirmDoesNotClickThrough: true` |
| Целевой смок 3 | `node demo/smoke_help_affordance.mjs` | `OK`, все поля `true`, включая `fallbackPickerHasConfirm`/`fallbackPickerConfirmCloses` |
| Bundle budget | `npm run bundle:budget` | initial View `299595 B` gzip, потолок `300500±2000` — в бюджете; запас `1471 Б` — тот же пред-существующий долг #367, не новый |
| Golden (advisory) | `npm run golden:verify` | 15 `different` из 150 сцен: 5 названных в ТЗ color-popover сцен (ожидаемо, см. AC1) + **10 `isometric-*`**, не относящихся к этому диффу (см. отдельный раздел ниже); 135 `passed` |
| Мутация 1 (M1) | `node scripts/mutation-gate.mjs --id=color-picker-invalid-confirm-latch-removed` | патч снимает `if (this._hexNeedsValidInput) {...}` в `_commitHex`; guard — `smoke_color_picker.mjs` → «тест покраснел, как обязан», «поймано 1 из 1» |
| Мутация 2 (M2) | `node scripts/mutation-gate.mjs --id=color-picker-confirm-click-through` | патч снимает `event.stopPropagation()` из `_confirm`; guard — новый `smoke_color_picker_consumers.mjs` → «тест покраснел, как обязан», «поймано 1 из 1» |
| Применимость всех мутантов | `node scripts/mutation-gate.mjs --check` | все патчи ложатся на текущий код, включая оба новых |

**Не гонял и почему** (не изменилось с r1, диф их не задевает):
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- `npm run invariants` / `model-invariants.mjs` — diff не меняет рёбра комнат, толщину, `layout`, `marker.space`, `open_spans`.
- Performance-профили — не названы в AC; §15 ТЗ обоснованно утверждает отсутствие влияния (один статический `button`, один `click`-handler в уже открытом lazy-picker); perf-smoke job в CI зелёный.
- Полная матрица `demo/smoke_*.mjs` и полный `scripts/mutation-gate.mjs` (226 смоков, десятки мутантов) — предрелизные гейты (PROCESS §8), не гейт код-ревью на задаче такого объёма; прогнаны только целевые/прямые + два новых мутанта.
- `npm run golden:accept` — не моя роль на этом этапе.
- «Одно число — один источник»: диф не добавляет и не меняет пользовательскую числовую величину (кнопка не показывает значение), правило неприменимо; `test/single-source-numbers.test.mjs` зелёный в составе `npm test`.

## Golden: 10 `isometric-*` diff — не относится к #476

`golden:verify` на этой ветке даёт 15 `different`. Пять совпадают с ТЗ (§13.4: `decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`, `general-color-popover-desktop-en`, `device-ripple-color-popover-mobile-ru`, `space-room-color-popover-desktop-ru`) — просмотрел `actual/`+`diff/` глазами, разница ровно в кнопке и вертикальном сдвиге содержимого, цвет/геометрия/тема не поехали. Остальные десять — все сцены `isometric-*` (`isometric-geometry-view-{dark,light}`, `isometric-live-layers-dark`, `isometric-touch-kiosk-dark`, `isometric-large-warm-remount-dark`, `isometric-stage3-overlays-{light,dark}`, `isometric-stage3-openings-dark`, `isometric-stage3-forced-colors-dark`, `isometric-stage3-no-filter-dark`) — их не должно быть, диф этой задачи не трогает ни один `src/*isometric*` файл.

Проверил происхождение: поднял временный `git worktree add /tmp/dev-check origin/dev --detach` (чистый `fc5973c2`, без единого коммита #476), собрал бандл (`npm run bundle:sync`) и прогнал `golden:verify` там же — те же ровно 10 сцен `isometric-*` выходят `different`, 0 отношения к color-picker. Chromium совпадает с эталоном побайтово по версии (`151.0.7922.34` — `demo/golden/baselines/baselines-index.json` vs установленный движок), так что это не известный кейс расхождения рендеринга по окружению. Причина видна по истории `dev`: `be5eeb41 fix: remove isometric overlay plates` (issue #471) поменял рендер, но последний коммит, принимающий golden-эталоны, — `de215578 test: accept isometric stage 3 golden baselines`, **до** `be5eeb41`; после него в `dev` нет коммита с принятыми isometric-эталонами. Это преднесённый долг `dev` от #471, полностью независимый от этой ветки — красный CI job `Golden-кадры против принятых эталонов` на `6e0e1f8c` красится и по этой причине тоже, но её причина не в #476. Golden — предрелизный, не код-ревью гейт (PROCESS §8); не завожу отдельный issue: не моя находка по существу (баг чужой, уже смердженной задачи #471, чинится обычным циклом приёмки эталонов перед бетой, а не патчем из этой ветки), и я не уверен, что это дефект, а не намеренно отложенное до релизного гейта принятие — распознавать и чинить чужой merged-код здесь означало бы расширять скоуп этой задачи.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **M1** — AC4-защита (`_hexNeedsValidInput`) доказана только смоком, без постоянного мутанта в `scripts/mutation-gate.mjs` | Зарегистрирован мутант `color-picker-invalid-confirm-latch-removed` (guard `demo/smoke_color_picker.mjs`) | `scripts/mutation-gate.mjs` (коммит `6e0e1f8c`); лично прогнал `--id=color-picker-invalid-confirm-latch-removed` → «тест покраснел, как обязан» |
| **M2** — AC3-защита (`stopPropagation()` в `_confirm`) не доказана тестом, способным упасть — единственный проверенный потребитель гасил клик выше по DOM независимо от мутации | Добавлен `demo/smoke_color_picker_consumers.mjs`, сценарий `generalConfirmDoesNotClickThrough` на «lightOn» (general settings, потребитель без внешнего гасителя); зарегистрирован мутант `color-picker-confirm-click-through` (guard — новый смок) | `demo/smoke_color_picker_consumers.mjs:49-63`, `scripts/mutation-gate.mjs` (коммит `6e0e1f8c`); лично прогнал `--id=color-picker-confirm-click-through` → «тест покраснел, как обязан» |

Оба закрытия проверены исполнением мутанта, не заявлением автора: патч применяется к `_commitHex`/`_confirm`, гоняется именно названный guard, тест красится, патч откатывается, `git status --short` пуст.

## Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-476-r1.md`, материал — дерево `94485fdc0eca504692dd2776c7f3c86518a8dfb9` (SHA-анкеры мертвы после второго ребейза, см. раздел выше; сам r1-документ пережил ребейз бит-в-бит, коммит `baea0fcf`).

Основание наследования — не доверие, а факт: `src/hp-color-opacity.ts` не менялся ни одним коммитом между `82f65acd` (реализация, предшествующая r1) и `HEAD`; я лично перечитал этот файл целиком в текущем HEAD (строки 480–740) и построчно сверил с описанием r1 (`_hexNeedsValidInput` семантика, `_confirm`/`_commitHex`/`_hexInput` взаимодействие, DOM-порядок кнопки, CSS-контракт) — расхождений нет.

Наследуется без повторной проверки:
- **AC1** (видимая кнопка/геометрия) — unit + 5 golden-сцен, разница только в кнопке (я сам пересмотрел эти же 5 сцен в этом заходе, см. таблицу гейтов — согласуется с r1);
- **AC2** (live parity, без дублирующего события) — мутация r1 №2 (снятие условия дедупликации в `_commitHex`) остаётся в силе, код не менялся;
- **AC3** (успешное завершение, кроме click-through-защиты — она пересмотрена заново выше) — закрытие/фокус-часть, код не менялся;
- **AC5** (прежние close paths) — Escape/outside/trigger, код нетронут;
- **AC6** (i18n/a11y) — 4 языка, DOM-порядок = Tab-порядок;
- **AC7** (touch/fallback/lifecycle, кроме нового `generalConfirmDoesNotClickThrough`-сценария) — Popover/fallback паритет;
- **AC8** (совместимость/бюджеты) — нет новых config/storage/backend полей;
- Low L1 (стилевая склейка `houseplan-card.ts:5932`), L2 (keyboard activation только через `.click()`), L3 (outside pointer/повторный trigger не покрыты автотестом, пред-существующий пробел) — сняты r1 с записью, делта их не касается, повторно не пересматривал.

## Находки

Нет. Обе Medium-находки r1 закрыты и лично перепроверены исполнением (см. «Закрытие раунда r1»). Новых находок дельта (M1/M2-фикс + чистый пересбор `dist/**` при ребейзе) не внесла — единственный файл продуктовой логики (`src/hp-color-opacity.ts`) не менялся со времени r1.

High: 0. Medium в скоупе: 0. Medium вне скоупа: 0 (десять `isometric-*` golden-diff — не находка этой задачи, см. раздел выше; issue не завожу).

## AC — таблица доказательств (r2, полная)

| AC | Чем доказан | Чем краснеет | Статус |
|---|---|---|---|
| AC1 видимая кнопка/геометрия | unit + `golden:verify` (5 сцен, diff — только кнопка) | не защитный AC, §2.7 не требует столбца | унаследовано из r1, перепроверено визуально в этом заходе |
| AC2 live parity, без дублирующего события | smoke `confirmClosesWithoutDuplicateOrClickThrough`, `validCorrectionAllowsConfirm` | мутация r1 №2 (не перезапускал — код не менялся) | унаследовано из r1 |
| AC3 успешное завершение / без click-through | smoke `confirmClosesWithoutDuplicateOrClickThrough` + **новый** `generalConfirmDoesNotClickThrough` | мутация `color-picker-confirm-click-through` — лично прогнал в этом заходе, красное | **перепроверено в r2** (M2 закрыта) |
| AC4 невалидный HEX / защита от обхода | unit + smoke `invalidHex*`, `repeatedConfirmCannotBypassInvalidHex` | мутация `color-picker-invalid-confirm-latch-removed` — лично прогнал в этом заходе, красное | **перепроверено в r2** (M1 закрыта) |
| AC5 прежние close paths | smoke `escapeClosesFirstAndRefocuses`; outside/trigger — проверено чтением (L3, пред-существующий пробел) | код не тронут | унаследовано из r1 |
| AC6 i18n/a11y | unit (`i18n.test.mjs`, `color-picker.test.mjs`) + smoke `englishLabels`/`cardLanguageOwnsCopy` | не защитный AC | унаследовано из r1 |
| AC7 touch/fallback/lifecycle | smoke `confirmIsFullWidthTouchTarget`, `smoke_help_affordance.mjs` (`fallbackPickerHasConfirm`/`fallbackPickerConfirmCloses`) + новый consumer-смок | не мутировал отдельно (оба пути реально прогнаны) | унаследовано + расширено новым смоком |
| AC8 совместимость/release/бюджеты | `no-new-any`, `check-docs`, `bundle:budget`, оба changelog в `82f65acd` | не защитный AC | унаследовано из r1 |

## Что проверено и корректно

- `src/hp-color-opacity.ts` идентичен коду, разобранному в r1: единственный коммит диапазона, трогающий файл (`82f65acd`), лежит до r1-ревью; перечитал файл заново и подтвердил соответствие описанию.
- Обе Medium-находки r1 закрыты воспроизводимыми мутантами, лично прогнанными до и после патча: `color-picker-invalid-confirm-latch-removed` и `color-picker-confirm-click-through` оба «покраснели, как обязаны».
- `demo/smoke_color_picker_consumers.mjs` тестирует click-through защиту на потребителе (`general settings/lightOn`) без внешнего гасителя событий — устраняет ровно ту слабость, которую нашёл r1 (там decor-tool consumer гасил клик независимо от продуктовой защиты).
- Дельта после второго ребейза ограничена сгенерированными `dist/**`/`custom_components/houseplan/frontend/**` и `docs/images/screenshots.json` (fingerprint) — подтверждено: `git log --oneline origin/dev..HEAD -- src/hp-color-opacity.ts` даёт один коммит, предшествующий обоим ребейзам.
- `dist`/`custom_components/houseplan/frontend` синхронны с исходником (`cmp` идентичны, `git status --short` пуст после пересборки).
- Process-gate, трейлеры (`Issue: #476` на всех 9 коммитах, `User-Visible: yes` только на `82f65acd` с обоими changelog в этом же коммите) — корректны.
- 10 golden-diff `isometric-*` подтверждённо не относятся к этому диффу: воспроизведены на чистом `origin/dev` в отдельном worktree без единого коммита #476.

## Чего не проверял

- `pytest tests_backend`, `npm run invariants`, performance-профили, полная матрица `demo/smoke_*.mjs`, полный `scripts/mutation-gate.mjs` (кроме двух целевых), `golden:accept` — см. обоснование в таблице гейтов.
- 15 «слабых» смоков по `stopPropagation` — просмотрел список имён повторно (не изменился с r1), все про другие поверхности, не про `hp-color-opacity`.
- Не расследовал глубже происхождение golden-долга #471 сверх того, что нужно, чтобы отделить его от этой задачи (не моя роль — задача другого issue).

## Вывод

High: 0. Medium в скоупе: 0. Medium вне скоупа: 0. Verdict: **зелёный**.

---

## Материал раунда

- Ветка: `issue/476-color-picker-ok`, HEAD `6e0e1f8ca24b10a87569f9fec07810e08b7fa71c`.
- `origin/dev` = `fc5973c2239a2d25485b1acc955d0b0da620370c`, совпадает с `git merge-base origin/dev HEAD` — ветка полностью приведена, конфликтов нет.
- Диапазон: `git log --oneline origin/dev..HEAD` (9 коммитов) / `git diff origin/dev...HEAD` (56 файлов).
- Предыдущий документ: `docs/reviews/CODE-REVIEW-476-r1.md` (коммит `baea0fcfedfacd0393a750750279ce4f869dd5b9`), материал того захода — дерево `94485fdc0eca504692dd2776c7f3c86518a8dfb9` (SHA-анкеры `34a6b276473c`/`b5a1001e` мертвы после второго ребейза, объяснено выше).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/476-color-picker-ok`, коммит `6e0e1f8ca24b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2e8d8ce4b2320c3d28cc4e815b1c45da973a797e`
  ```
  git log --all --format='%H %T' | grep 2e8d8ce4b232
  ```
- ТЗ `docs/specs/476-color-picker-ok.md`, блоб `d21066d56e69c35fe7d0b40d9f965968dac9f803`
  ```
  git log --all --find-object=d21066d56e69c35fe7d0b40d9f965968dac9f803 -- docs/specs/476-color-picker-ok.md
  ```
