# CODE-REVIEW-39-r1

- Issue: [#39 «[HP-UX-09] большие подложки»](https://github.com/Matysh/houseplan-card/issues/39)
- ТЗ: `docs/specs/039-large-backdrops.md`, ревизия 4.1 (спек-ревью зелёное на r3, SHA `9431a5ce`)
- Ревью-SHA: `0d82ee0a2501fc9a1db0730cc5ae238010d0efbc` (ветка `issue/39-large-backdrops`, уже ребейзнута на `origin/dev`; предыдущий заход не состоялся из-за конфликта ребейза и цикл не потратил — см. комментарии issue 06:45–06:46 UTC)
- Заход: **r1** · блокирующих циклов до этого разбора: **0/4** (трек — полный, лимит 4)
- Диапазон: единственный коммит `0d82ee0a` поверх `origin/dev` (`git log --oneline origin/dev..HEAD`)

## Скоуп диффа

50 файлов, +1331/-371. Продуктовый код: `src/backdrop-probe.ts` (новый, парсер
заголовков), `src/backdrop-pick.ts` (новый, общий pick-флоу и гард-диалог),
точечные правки `_pickPlanFile` в `src/houseplan-editor-runtime.ts` и
`src/houseplan-onboarding-runtime.ts`, +9 i18n-ключей ×3 языка,
`src/houseplan-card.ts` (поле `_backdropGuard`, рендер гарда). Остальное —
тест (`test/backdrop-probe.test.mjs`, новый), смок (`demo/smoke_backdrop_guard.mjs`,
новый), 5 новых записей в `scripts/mutation-gate.mjs`, `demo/benchmark_backdrop_decode.mjs`,
доки (BACKDROP/оба USER-GUIDE/TESTING/оба CHANGELOG) и сгенерированное
(`dist/**`, `custom_components/houseplan/frontend/**`, скриншоты документации).
Ни одного файла `custom_components/**/*.py` и ни одной правки геометрии
(комнаты/рёбра/`layout`/`marker.space`/`open_spans`) — backend-гейт и
model-invariants к этому диффу не относятся.

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без вывода |
| unit | `npm test` | `# tests 1518 / pass 1517 / fail 0 / skipped 1` — совпадает с заявленным в хендоффе |
| build + bundle sync | `npm run build` → `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `diff -rq dist/houseplan-assets custom_components/houseplan/frontend/houseplan-assets` | точка входа побайтово совпадает, дерево ассетов идентично; `git status` после сборки чист — коммит уже содержит пересобранный бандл |
| bundle budget | `npm run bundle:budget` | initial View 273 386 / 282 000 Б gzip, запас 8 614 Б (в бюджете; авторская цифра 273 173 отличается на десятки байт, не критично) |
| docs fingerprint | `node scripts/check-docs.mjs` (diff трогает `src/**`) | «Documentation checks passed (7 files, 10 external links)» |
| new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (437 добавленных строк в 5 файлах) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 13 «прямое совпадение», 23 «слабая связь» (реестр на 201 смок) — решение по каждой группе ниже |
| mutation gate (адресно) | `node scripts/mutation-gate.mjs --id=<4 новых id>` (см. ниже) | все 4 мутанта поймали свою поломку — тест умеет падать |

### Решение по smoke-select

Прогнал сам (среда без DNS `demo.local` — добавил `127.0.0.1 demo.local` в
`/etc/hosts`, затем `npm run bundle:sync`, чтобы обновить `demo/srv/assets`):

- `node demo/smoke_backdrop_guard.mjs` — новый смок, 21/21 ассертов зелёные;
- `node demo/smoke_plan_upload_race.mjs` — OK (тот же `_pickPlanFile`, гонка upload/race не тронута);
- `node demo/smoke_plan_upload_reject.mjs` — OK, это же доказательство **AC7** (транзакционный контракт: cleanup при reject, диалог не закрывается) — контракт не менялся, смок не редактировался;
- `node demo/smoke_saved_plans.mjs` — OK;
- `node demo/smoke_audit_1490.mjs` — OK;
- `node demo/smoke_cold_view_toggle.mjs` — OK (прямое совпадение по `_editorRuntime`);
- `node demo/smoke_esc_dialogs.mjs` — OK, включая кейсы `stacked`/`stacked2` (несколько `hp-dialog` друг над другом уже работают штатно, но этот смок не проверяет закрытие диалога ВО ВРЕМЯ busy-операции — см. M1).

Остальные 11 из 13 «прямых совпадений» (`smoke_lazy_editor_chunk`,
`smoke_partition_openings`, `smoke_cold_view_vacuum`, `smoke_furniture`,
`smoke_grid_scale_invariance`, `smoke_ha_controls`, `smoke_help_affordance`,
`smoke_junction_limits`, `smoke_optimize_coordinate_canonicalization`,
`smoke_room_resize`, `smoke_zero_wall_migration_unblocked`) не прогонял:
инструмент отметил их по `_editorRuntime`/`_showToast` — общеупотребимым
идентификаторам, которые дифф не меняет по смыслу (диалог гарда лишь читает
`_editorRuntime`/`_onboardingRuntime` для выбора рантайма и вызывает уже
существующий `_showToast`; ни то, ни другое поведение не переопределено).
Аналогично не прогонял 23 «слабые связи» по `_spaceDialog`, кроме
перечисленных пяти, ближайших к затронутому коду. Полная матрица —
предрелизная обязанность, не гейт этого ревью.

### Не прогонял и почему

- `npm run golden:verify` — ТЗ прямо оговаривает «golden: не задевается»
  (диалог не входит в golden-матрицу); дифф не трогает рендерер/геометрию —
  согласен, не прогонял;
- `python -m pytest tests_backend -q` — 0 файлов `custom_components/**/*.py` в диффе;
- `node scripts/model-invariants.mjs` — дифф не трогает рёбра комнат, толщину,
  `layout`, `marker.space`, `open_spans`;
- performance-профили — ТЗ явно исключает `demo/benchmark_backdrop_decode.mjs`
  из перф-гейта CI (разовая калибровка, не регресс-гейт), в AC перфоманс не назван.

## Проверка AC (все девять)

Прогнал юниты и смок сам, проверил, что зарегистрированные мутанты
действительно красят `smoke_backdrop_guard` (адресно, не «весь набор»):
`node scripts/mutation-gate.mjs --id=backdrop-probe-always-safe`,
`--id=backdrop-downscale-drops-alpha`, `--id=backdrop-hard-demoted-to-warn`,
`--id=backdrop-phase2-falls-back-to-original` — все четыре: «тест
покраснел, как обязан». Рабочее дерево после каждого прогона чистое
(mutation-gate работает во временном воркчасти).

| AC | Доказательство | Статус |
|---|---|---|
| AC1 — warn до decode | юнит-граница ±1 у `WARN_DECODED_BYTES`/`HARD_DIMENSION`; смок `noDecodeBeforeChoice`; мутант `backdrop-probe-always-safe` красит | **доказано** |
| AC2 — уменьшенная копия 4096/aspect/alpha | юнит `downscaleDimensions`; смок — реальный decode 6200→4096, alpha→PNG, opaque→JPEG; мутант `backdrop-downscale-drops-alpha` красит | **доказано** |
| AC3 — «оригинал» байт-в-байт | смок `b64ParityWithLegacyLoop` (не юнит — см. Low ниже) | **доказано**, способом доказательства не тем, что назвало ТЗ |
| AC4 hard-фаза1 | юнит `HARD_DIMENSION+1`→hard; смок «только Отмена», ноль decode; мутант `backdrop-hard-demoted-to-warn` красит | **доказано** |
| AC4б hard-фаза2 | смок: reject и вечный hang под тестовым таймаутом, тост, чистый staging, повторный выбор; мутант `backdrop-phase2-falls-back-to-original` красит | **доказано для честного пути**, но см. **M1** — есть путь, которым «отмена» не отменяет |
| AC5 — SVG байпас | смок `svgBypassesGuard`/`svgNoDecode`; прочитано в коде: `classifyPlanFile` возвращает `pass` для `ext==='svg'` раньше вызова `probeBackdrop` | **доказано** |
| AC6 — битые заголовки → unknown | юнит: 11 враждебных фикстур (PNG/JPEG/WebP/GIF, обрезки, нулевые/гигантские значения) → все `unknown`; прочитано в `renderBackdropGuard`: ветка `unknown` не подставляет числа и не является `hard` (те же три кнопки, явный выбор обязателен) | **доказано** |
| AC7 — транзакция не поменялась | существующий, НЕ тронутый диффом `demo/smoke_plan_upload_reject.mjs` — прогнан, зелёный | **доказано наследуемым тестом** |
| AC8 — EXIF-ориентация | код передаёт `imageOrientation:'from-image'` в `createImageBitmap` — правдоподобно корректно (браузерный контракт), НО ни юнит, ни смок, ни явная запись «проверено чтением» этого не покрывают; `grep -rn EXIF` по `test/**`,`demo/**` — ноль совпадений; чек-лист `docs/TESTING.md`, добавленный этим же диффом, тоже не содержит пункта про EXIF | **не доказано** — см. **M3** |
| AC9 — паритет FileReader | то же, что AC3: доказано смоком, не юнитом | **доказано**, способ доказательства расходится с ТЗ |

## Находки

Все три — Medium, все в скоупе задачи (правятся автором в этой же задаче,
без отдельного issue). High нет.

### M1 — отмена гард-диалога во время busy не отменяет применение

**Файл:** `src/backdrop-pick.ts`, функции `original()` (строки ~179–184) и
`reduced()` (строки ~185–200).

И `original()`, и `reduced()` защищены от повторного клика флагом `busy`
(`if (host._backdropGuard?.busy) return;`), но внешний `<hp-dialog
dismiss-on-scrim @hp-close=${() => close()}>` не проверяет `busy` вовсе —
ни ESC, ни клик по скриму. `HpDialog._onKeyDown` (`src/hp-dialog.ts:395-406`)
закрывает верхний диалог по Escape безусловно, `_onFallbackClick`
(`src/hp-dialog.ts:433-435`) — по клику на скрим тоже безусловно.
Значит: пользователь может нажать «Загрузить уменьшенную копию»
(`busy=true`, идёт decode/downscale), затем нажать Escape или кликнуть по
фону — диалог гарда пропадает (`_backdropGuard = null`), но promise внутри
`reduced()`/`original()` продолжает висеть в памяти и по завершении всё
равно вызывает `apply(payload)`, молча подставляя `planFile` в уже как
будто отменённый диалог пространства.

**Воспроизведено** (одноразовый скрипт на базе `demo/serve.mjs`, не
закоммичен): подменил `window.createImageBitmap` на промис, зависающий до
явного `release()`; выбрал крупный JPEG → warn-диалог → клик «Загрузить
уменьшенную копию» → дождался `_backdropGuard.busy === true` → отправил
`Escape` в диалог гарда → `_backdropGuard` стал `null`,
`_spaceDialog.planFile` в этот момент всё ещё `null` (ожидаемо) → вызвал
`release()` → через секунду `_spaceDialog.planFile` заполнился уменьшенной
копией, хотя диалог давно закрыт и пользователь не подтверждал результат.
Итог прогона:
```json
{"wasBusy": true, "guardDismissedWhileBusy": true,
 "planFileStillNullRightAfterDismiss": true, "planFileAppliedAfterDismiss": true}
```

Это не потеря сохранённого плана (Save остаётся отдельным явным шагом) и не
проблема безопасности — но это ровно тот класс «тихого действия после
отмены», который сама фича вводит как принцип для фазы 2
(«молча грузить то, от чего пользователь только что отказался, нечестно» —
спека, UX/hard). Тут по факту происходит симметричный случай: пользователь
отказался (закрыл диалог), а операция всё равно применяется.

**Не блокирует** (Medium, не High): нет потери данных и нет обхода
lock-инварианта; чинится одной проверкой перед `apply` (например, сверить,
что `host._backdropGuard` всё ещё ссылается на тот же `guard`/токен, прежде
чем коммитить `payload`, либо не давать `dismiss-on-scrim`/ESC работать,
пока `busy`). Общий примитив `hp-dialog` не проверяет `busy` нигде —
менять его глобально не обязательно, чинить локально в
`backdrop-pick.ts` дешевле и безопаснее для остальных потребителей.

### M2 — «одно число, один источник» нарушено для `HARD_DIMENSION`

**Файл:** `src/backdrop-pick.ts:169` (`renderBackdropGuard`).

```ts
const body = hard
  ? host._t('backdrop.too_large_body', {
    w: probe.width ?? 0, h: probe.height ?? 0, limit: 16384,
  })
```

`limit: 16384` — литерал, а не импортированная константа. `HARD_DIMENSION`
уже экспортируется из `backdrop-probe.ts` и **не импортирован** в
`backdrop-pick.ts` (в блоке импорта наверху файла есть
`DOWNSCALE_JPEG_QUALITY, DOWNSCALE_TARGET_PX, DOWNSCALE_TIMEOUT_MS,
downscaleDimensions, probeBackdrop` — `HARD_DIMENSION` в списке нет). Само
ТЗ формулирует ровно тот принцип, который здесь нарушен: «Пороги...
собраны В ОДНОМ модуле... полевая рекалибровка после жалоб = правка одного
файла» (раздел «Честная оговорка протокола»). Сейчас правка одного файла
(смена `HARD_DIMENSION` в `backdrop-probe.ts`) молча разойдётся с текстом
диалога, который продолжит показывать старое число. Число не проверено ни
одним тестом (юниты гарда/пробы не рендерят диалог, а смок не проверяет
текст `too_large_body` на конкретное число — только заголовок и наличие
кнопки «Отмена»).

**Фикс** — однострочный: добавить `HARD_DIMENSION` в импорт из
`./backdrop-probe` и передать `limit: HARD_DIMENSION` вместо литерала.

### M3 — AC8 (EXIF-ориентация) не доказан ни тестом, ни явной записью

См. таблицу AC выше. Код (`src/backdrop-pick.ts:114`,
`createImageBitmap(state.file, { imageOrientation: 'from-image' })`)
делегирует поворот декодеру браузера, что само по себе разумно — но ТЗ
называет это отдельным пронумерованным AC8 с обязательным способом
доказательства «фикстура», и по `PROCESS.md` §2.7 «каждый AC либо доказан
автотестом..., либо разобран по коду с явной записью "проверено чтением,
не исполнением"». Ни то, ни другое не сделано: не нашёл ни одного
упоминания EXIF/orientation в `test/**` или `demo/**`
(`grep -rn "exif" --include={test,demo}/**` — единственное совпадение
это сам комментарий в `backdrop-pick.ts`), а хендофф-комментарий автора,
перечисляя, что покрыто тестами, EXIF не упоминает вовсе. Чек-лист
`docs/TESTING.md`, добавленный этим же диффом, тоже не содержит строки
про EXIF — то есть пробел не отмечен и на ручном треке.

**Фикс** — либо смок/юнит с реально повёрнутым JPEG (EXIF orientation tag
≠ 1) и проверкой, что `downscaleDimensions` получает уже
скорректированные браузером `bitmap.width/height` (а не сырые SOF-числа),
либо явная запись в ТЗ/хендоффе «AC8 проверено чтением: `imageOrientation:
'from-image'` — стандартный, широко поддерживаемый флаг Canvas API,
поэтому корректность делегирована браузеру» — с этим согласился бы,
но такой записи сейчас нет.

## Low (не блокирует, только к сведению)

AC3/AC9 в ТЗ помечены «паритет-юнит», а по факту паритет base64
(`b64ParityWithLegacyLoop`) проверяется в `demo/smoke_backdrop_guard.mjs`,
не в `test/backdrop-probe.test.mjs`. Это осознанный и правильный выбор:
`FileReader` отсутствует в голом `node --test` (`node -e "console.log(typeof
FileReader)"` → `undefined`), которым гоняется `npm test`
(`package.json`: `"test": "tsc ... && node --test test/*.test.mjs"`), а
проект не подключает jsdom/happy-dom. Проверять реальным браузерным
раннером в смоке — не хуже, а местами честнее гипотетического юнита.
Снимаю находку без правки, отмечаю только неточность формулировки ТЗ.

## Что проверено и корректно (сверх таблицы AC)

- Парсер заголовков (`backdrop-probe.ts`) — построчно прочитан: все
  извлечения байт (`u32be`/`u16be`/`u24le`/`ascii`) безопасны на выходе за
  границы массива (typed array возвращает `undefined`, арифметика даёт
  `NaN`/0, не исключение); все циклы обхода чанков/маркеров ограничены
  (`hops < 64`/`< 256`); `PLAUSIBLE_MAX_SIDE = 1_000_000` отсекает
  переполнение при `width*height*4` (максимум ~4e12, далеко от
  `Number.MAX_SAFE_INTEGER`) и явно ловит враждебный WebP VP8X
  (`u24le+1` может достигать 16 777 216 — отсекается плаусибл-фильтром);
  security-раздел ТЗ подтверждён кодом и fuzz-таблицей юнитов;
- новый `fileToBase64` даёт байт-в-байт тот же результат, что старый
  ручной цикл (смок `b64ParityWithLegacyLoop`);
- оба рантайма (`houseplan-editor-runtime.ts`,
  `houseplan-onboarding-runtime.ts`) используют один и тот же
  `classifyPlanFile`/`renderBackdropGuard` — гард не может разойтись между
  диалогом пространства и онбордингом, как и заявлено в ТЗ;
  `_backdropGuard` не рендерится, если не открыт ни один из лениво
  загруженных рантаймов — в eager View-граф ничего не попало (подтверждено
  бюджетом бандла: initial View +698 Б — это словарь i18n, не логика);
  `input.value = ''` в начале `_pickPlanFile` — подтверждено смоком
  (`repickReopensGuard`), что повторный выбор того же файла срабатывает;
- транзакционный контракт (AC7) не тронут и не регрессировал —
  существующий смок зелёный без правок;
  i18n-паритет en/ru/de (в т.ч. незадокументированный в ТЗ ключ
  `backdrop.reducing`) проверен существующим общим тестом
  (`test/i18n.test.mjs`, сверка наборов ключей) — прошёл в составе
  `npm test`; несовпадение с перечнем ключей ТЗ — не находка (доп. ключ
  для текста кнопки в busy-состоянии, не влияет на корректность,
  наследуется как техническая деталь автора);
  4 из 5 заявленных мутантов — новые записи в `scripts/mutation-gate.mjs`,
  прогнаны все и подтверждают, что `smoke_backdrop_guard.mjs` красится
  именно на тех регрессиях, которые он обязан ловить (5-й, «staging не
  чистится при отказе», — это существующий мутант транзакции, не новый,
  соответствует формулировке ТЗ «без изменений»);
  трейлеры коммита корректны (`Issue: #39`, `User-Visible: yes`), оба
  changelog отредактированы в этом же коммите (`git show -s --format=full
  HEAD`).

## Чего не проверял

- полную матрицу смоков (201 шт.) — не по AC этой задачи, предрелизная
  обязанность;
- `golden`, `pytest tests_backend`, `model-invariants`, perf-профили — не
  относятся к диффу (см. таблицу выше и обоснование в ТЗ);
- ручное тестирование на реальном планшете/WebView — вне цикла ревью по
  процессу; пороги калибровались десктопным Chromium с честной оговоркой
  в самом ТЗ, я эту оговорку не оспариваю (уже была предметом спек-ревью
  r1–r3);
- `demo/benchmark_backdrop_decode.mjs` не запускал — калибровочный
  скрипт, не гейт, замер уже зафиксирован в тексте ТЗ.

## Вердикт

Три Medium, все в скоупе, ноль High. M1 и M3 — не косметика: M1 — реальная,
воспроизведённая гонка в новом коде (не путать с «не блокирует» —
не блокирует именно потому что нет потери сохранённых данных, а не
потому что находка слабая); M3 — пронумерованный AC без единого
доказательства. M2 — однострочный фикс, но ровно тот класс дефекта,
который процесс просит ловить целенаправленно.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче**
