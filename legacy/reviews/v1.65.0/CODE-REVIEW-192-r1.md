# CODE-REVIEW-192-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/192
- **ТЗ:** лёгкий трек (`small`) — живёт в теле issue #192 (ревью —
  `docs/reviews/SPEC-REVIEW-192-r1.md`, вердикт зелёный, Low-1 снят с записью,
  Medium: 0)
- **Диапазон:** `git log --oneline origin/dev..HEAD` / `git diff
  origin/dev...HEAD` — один коммит `508d38c` «Show spectrum on hue slider»
  (`Issue: #192`, `User-Visible: yes`)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`
- **Цикл:** r1/2 (лёгкий трек)

## Скоуп ревью

Проверялось соответствие реализации:

- контракту из тела issue #192 (§«Контракт поведения и UX», AC1–AC5, план
  автотестов, риски);
- `docs/SCOPE.md` — задача не расширяет продукт за пределы editor usability
  polish (J4/J6), View/kiosk не затронуты;
- `AGENTS.md`/`PROCESS.md` — классы файлов, трейлеры, оба changelog в одном
  `User-Visible: yes` коммите, изоляция (только `.hue-range`, не общий
  `input[type='range']`);
- фактическому поведению `src/hp-color-opacity.ts` в браузере (Chromium,
  Playwright), а не только по чтению CSS;
- реально выполненным гейтам (см. ниже), включая полный `npm run
  golden:verify` — diff меняет видимый рендер открытого picker, что подпадает
  под критерий «рендер/геометрия/стили» из инструкции к этому ревью.

## Как проверялось

1. Прочитан весь diff (`git diff origin/dev...HEAD --stat` и файлы по
   отдельности): `src/hp-color-opacity.ts` (+23/-0 в стилях), `test/color-
   picker.test.mjs` (+15 строк, новый тест), `demo/smoke_color_picker.mjs`
   (+5 строк), `demo/golden/matrix.mjs` (+3, новая сцена `decor-color-
   popover-desktop-en`), `test/golden-matrix.test.mjs` (+10, contract-тест
   на список сцен), `docs/{CHANGELOG.md,CHANGELOG.ru.md,USER-GUIDE.md,
   USER-GUIDE.ru.md,TESTING.md}`, сгенерированные `dist/houseplan-card.js` /
   `custom_components/houseplan/frontend/houseplan-card.js` /
   `demo/srv/assets/houseplan-card.js`.
2. Прочитано тело issue #192 целиком и все четыре комментария (аналитика
   владельца, зелёное SPEC-ревью, хендофф реализации) — сверено, что
   реализация не расширяет и не сужает скоуп относительно принятого ТЗ
   (только `.hue-range`, S/V/opacity не тронуты).
3. Прочитан `src/hp-color-opacity.ts:225-312` построчно: `input[type='range']`
   (общий, высота 40px, `margin: -5px 0`) не изменён; `.hue-range` добавляет
   `--hp-picker-hue-track` (linear-gradient, 7 стопов, циклический —
   0%/100% оба `#f00`) и `accent-color` не тронут; `::-webkit-slider-
   runnable-track` и `::-moz-range-track` — одинаковый контракт (высота
   10px, `border`, `border-radius: 999px`, `background: var(--hp-picker-
   hue-track)`); `::-moz-range-progress` обнулён в `transparent`, чтобы
   Gecko не закрашивал левую часть трека сплошным accent-цветом поверх
   градиента; `@media (forced-colors: active)` переопределяет оба трека на
   `Canvas`/`ButtonText` — системный безопасный fallback без градиента.
4. Подтверждено, что новый CSS не покидает `.hue-range`: точечный grep по
   файлу — `::-webkit-slider-thumb`/`::-moz-range-thumb` для `.hue-range`
   отсутствуют (совпадает с тем, что ТЗ не заявляло новый thumb-стиль,
   только «остаётся различимым»); общий `input[type='range']` не содержит
   `linear-gradient`/`hp-picker-hue-track` (подтверждено также unit-тестом
   `commonRange`).
5. **Дисциплина falsifiability применена к обоим прогнанным тестам:**
   - unit: воссоздан pre-#192 файл во временном `git worktree` на
     `origin/dev` и прогнан новый тест `test/color-picker.test.mjs`
     («the hue range exposes one cyclic spectrum...») именно против старого
     `.hue-range` (только `accent-color`, без градиента) — тест корректно
     падает на первой же проверке
     (`--hp-picker-hue-track:\s*linear-gradient` не находит совпадения).
     Worktree удалён после проверки.
   - browser smoke: `node demo/smoke_color_picker.mjs` прогнан на текущем
     дереве — все 15 проверок `true`, включая новую `hueTrackContract`
     (class, `min/max/step`, `--hp-picker-hue-track` содержит
     `linear-gradient`, `height >= 40px`); падение этой же проверки на
     pre-#192 бандле подтверждено тем же временным worktree (переменная
     `--hp-picker-hue-track` не существует на старом `.hue-range`, так что
     проверка `.includes('linear-gradient')` даёт `false`).
6. Собран собственный бандл (`npm run build`) и сверен SHA-256 всех трёх
   копий (`dist/`, `custom_components/houseplan/frontend/`,
   `demo/srv/assets/`) — совпадает с заявленным автором в хендоффе
   (`8ec9aff0...`).
7. Прогнан `npm run golden:verify` (полный набор, 67 активных сценариев) —
   не только названные в TESTING.md сцены: подтверждён список расхождений
   (см. «Обязательные гейты» и «Гейты по необходимости»).
8. **Живая проверка в браузере сверх названных в issue способов
   доказательства** (см. «Находки»): открыт picker через тот же харнесс,
   что использует `smoke_color_picker.mjs`
   (`demo/serve.mjs` + `card._decorTool='line'` + `.trigger` click), hue
   программно выставлялся в 0°, 55°, 205°, 210°, 220°, 235°, 250°, 260°,
   каждый раз делался точный `page.screenshot({clip})` по
   `getBoundingClientRect()` самого `.hue-range`, чтобы увидеть реальный
   растровый результат, а не полагаться на чтение CSS. Аналогичная проверка
   повторена на независимо собранном pre-#192 бандле (тот же временный
   worktree) для сравнения «было/стало».
9. Проверены трейлеры и class-принадлежность: `git show 508d38c --stat` —
   класс A (`src/hp-color-opacity.ts`), B (`test/`, `demo/`), C (`docs/`), D
   (все три копии бандла) — все в одном коммите; `Issue: #192`,
   `User-Visible: yes`; оба changelog редактируются в этом же коммите.
10. Проверено отсутствие новых runtime dependencies:
    `git diff origin/dev...HEAD -- package.json package-lock.json` — пусто.

## Обязательные гейты (всегда)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | `889/889`, 0 fail (совпадает с заявленным автором) |
| Build + сверка бандлов | `npm run build` + `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | все три идентичны, `8ec9aff054216bc8df5df9bf6410213254a352c7b742b4b28231e0a0048171b2` — совпадает с хендоффом автора |

Falsifiability (тест должен уметь падать), применена к обоим прогнанным
наборам — см. п.5 выше («Как проверялось»): unit и browser-smoke оба
корректно падают на pre-#192 коде.

## Гейты по необходимости

| Гейт | Почему запускался | Результат |
|---|---|---|
| `node demo/smoke_color_picker.mjs` | назван в AC2 issue как способ доказательства, единственная затронутая поверхность | зелёный, все 15 проверок `true`, включая новую `hueTrackContract`; falsifiability подтверждена (см. выше) |
| `npm run golden:verify` (полный набор, 67 активных сценариев) | diff меняет видимый рендер открытого picker (новый градиент трека) — подпадает под критерий «рендер/геометрия/стили/слои» из инструкции к ревью | 65 `passed`, 1 `different` (`decor-color-popover-mobile-ru` — ожидаемо, картинка просмотрена, см. «Находки»), 1 `missing-baseline` (`decor-color-popover-desktop-en` — новая сцена, ожидаемо). Изоляция (AC4) подтверждена: ни один из 65 остальных сценариев, включая все прочие поверхности с `input[type=range]` (тряй-панели, диалоги устройств), не изменился |
| `python -m pytest tests_backend -q` | не запускался | diff не трогает ни одного файла `custom_components/**/*.py` (подтверждено `git diff --stat`), гейт неприменим |
| performance-профили | не запускались | AC явно называет причину не запускать: «статичный CSS gradient, runtime вычислений нет»; diff не трогает canvas/рендер-цикл плана, только статичный CSS двух `input[type=range]` |

## Что проверено и корректно

- **AC1 — спектр.** `.hue-range` получает циклический 7-стопный
  `linear-gradient(to right, #f00 0% … #f00 100%)`, применённый через
  `::-webkit-slider-runnable-track` и `::-moz-range-track` с одинаковыми
  стопами (общая CSS-переменная `--hp-picker-hue-track`) — подтверждено
  чтением и unit source-contract тестом. Живой рендер в Chromium (скриншоты
  hue=0/55/205/235/250) показывает корректный порядок цветов: красный →
  жёлтый → зелёный → циан → синий → маджента → красный, совпадает со
  стандартным hue-кругом.
- **AC2 — управление.** `min=0/max=359/step=1` не изменены; mouse (через
  `.value` + `input` event), touch (pointer-путь `sv-field` не тронут,
  сам hue остаётся нативным range), Arrow/`Shift+Arrow` (`shiftArrowUsesTenStep`),
  focus/Escape и `hp-color-opacity-change` — все существующие smoke-проверки
  остались зелёными без изменений ожиданий, кроме одной новой добавленной
  (`hueTrackContract`); 120° по-прежнему даёт `#00ff00` (`hueUpdatesSharedDraft`).
- **AC4 — изоляция.** Полный `golden:verify` (67 сценариев) подтверждает: из
  всех поверхностей с `input[type='range']` (decor picker, диалоги устройств,
  тряй-панели) изменился рендер только у самого открытого color popover;
  общий `input[type='range']` блок не содержит градиентных деклараций
  (unit-тест `commonRange` + собственноручный grep).
- **AC5 — совместимость.** `package.json`/`package-lock.json` не менялись;
  API компонента (`color`/`opacity`/`showOpacity`/`disabled`,
  `hp-color-opacity-change`) не тронуто; i18n-строк не добавлено — сверено
  чтением diff.
- **forced-colors fallback (часть AC3).** `@media (forced-colors: active)`
  корректно переопределяет оба трека на системные `Canvas`/`ButtonText` без
  градиента — безопасный вариант деградации, соответствует общей практике
  WCAG для forced-colors.
- **Gecko progress не перекрывает градиент.** `::-moz-range-progress`
  обнулён в `background: transparent` — без этого Firefox залил бы левую
  часть трека сплошным accent-цветом поверх спектра, что было прямо названо
  риском в хендоффе автора; проверено чтением (Gecko недоступен в среде
  ревью, как и заявлено в «Принятых предположениях» issue).
- **Изоляция gradient от текущего выбранного цвета (п.3 контракта).**
  `--hp-picker-hue-track` — статическая константа, не зависит от `_hue`;
  подтверждено чтением и тем, что unit-тест матчит буквальные hex-стопы.
- **prefers-reduced-motion (п.4 контракта).** Новый CSS не добавляет
  `transition`/`animation`; существующий `@media (prefers-reduced-motion:
  reduce)` блок не тронут — подтверждено diff'ом.
- **Trailers/классы файлов/changelog.** Коммит `508d38c` несёт `Issue: #192`,
  `User-Visible: yes`; оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) редактируются в этом же коммите; формулировки
  («шкала «Оттенок» показывает полный спектр») соответствуют
  `docs/USER-GUIDE.ru.md`, термины не изобретены.
- **Golden-сценарии (план автотестов).** Новая light-сцена
  `decor-color-popover-desktop-en` добавлена и покрыта отдельным
  contract-тестом (`test/golden-matrix.test.mjs`), проверяющим ровно два
  сценария `dialog === 'decor-color'` с ожидаемыми `theme`/`language`/
  `width` — соответствует плану автотестов issue.

## Находки

### Medium-1 — thumb hue-шкалы теряет контраст с треком в диапазоне циан/синий/индиго (~195°–260°)

**Файл:** `src/hp-color-opacity.ts:234-259` (новый градиент трека без
компенсирующего стиля thumb).

AC3 issue дословно требует: «Spectrum/thumb читаемы в light/dark... thumb
остаётся различимым». Риск-таблица самого issue заранее называла этот
сценарий («Thumb теряется на ярком секторе») и предлагала меру
(«контрастная border/shadow без уменьшения focus indicator») — эта мера не
реализована: в diff нет ни `::-webkit-slider-thumb`, ни `::-moz-range-thumb`
для `.hue-range`.

**Воспроизведение (выполнено, не предположение).** Открыт picker тем же
харнессом, что и `demo/smoke_color_picker.mjs` (`demo/serve.mjs`, decor →
Line → `.trigger`), hue выставлялся программно через `input.value` +
`input`-event, затем снят `page.screenshot({ clip })` строго по
`getBoundingClientRect()` элемента `.hue-range`:

- при hue 205° (то самое значение, что используется в обеих golden-сценах
  `decor-color-popover-mobile-ru` и `decor-color-popover-desktop-en`,
  просмотренных автором как «контраст корректен») граница между thumb и
  треком уже заметно слабее, чем на жёлтом/красном участке;
- при 210°, 220°, 235°, 250° thumb почти сливается с треком — узнаваемого
  контрастного контура нет, различим только по едва заметному перепаду
  яркости.

Причина: thumb рисуется фиксированным системным цветом браузера (в
тестируемом Chromium — solid blue), который не меняется с `_hue`
(независимый от #192 давний баг: `accent-color: var(--hp-picker-hue)` не
красит сам thumb ни до, ни после этого коммита — проверено тем же способом
на независимо собранном pre-#192 бандле, thumb там тоже фиксированно-синий,
но на равномерно-сером треке это никогда не создавало проблемы контраста).
До #192 нейтральный серый трек гарантировал контраст с любым
фиксированным цветом thumb; #192 заменяет этот трек радугой, и ровно в той
части круга, что близка по тону к цвету самого thumb, декларированное в
AC3 «thumb остаётся различимым» перестаёт быть верным для реального
Chromium-рендера — единственного движка, фактически исполняемого в CI/
smoke/golden этого проекта (Gecko/WebKit заявлены как source-contract-only
по «Принятым предположениям» issue).

**Почему Medium, не Low.** Находка не гипотетическая: воспроизведена прямым
запуском в том же харнессе, что использует официальный smoke, на реальном
исполняемом движке проекта, включая ровно те hue-значения, что приняты в
golden baseline. Диапазон ~65° из 359° (≈18% круга) — это не край случай, а
частый выбор (синие/циановые акценты в HA-конфигурациях освещения).
Функциональность не ломается (клавиатура, числовая подпись `205°`,
drag из любой точки трека работают), поэтому не High; но декларированный
критерий приёмки (AC3, «thumb остаётся различимым») в этом диапазоне не
выполняется, что не позволяет закрыть находку как Low с одной лишь записью.

**Действие:** заведён отдельный issue
[#194](https://github.com/Matysh/houseplan-card/issues/194) (`bug`, `P3`,
`S1-new`), со ссылкой на #192 и на этот документ. Обнаруженный смежный
давний баг «`accent-color` не красит thumb вообще» описан в issue как явно
не-скоуп — самостоятельный вопрос, а не часть этой находки.

## Чего не проверял

- **Реальный Firefox/Gecko и Safari/WebKit.** Смотрел только Chromium
  (единственный движок, доступный в среде ревью и в CI проекта). Gecko/
  WebKit-декларации (`::-moz-range-track`, `::-moz-range-progress`)
  проверены исключительно чтением CSS и совпадением стопов с
  webkit-версией — это прямо принято issue как достаточное доказательство
  («Принятые предположения»: «WebKit/Safari и Gecko declarations
  доказываются source-contract и code review»), не пытаюсь выдать это за
  исполненный тест.
- **Реальный screen-reader / forced-colors режим ОС.** `@media
  (forced-colors: active)` прочитан построчно (валидный синтаксис, системные
  ключевые слова `Canvas`/`ButtonText`), но не исполнялся в браузере с
  реально включённым forced-colors — то же ограничение среды, что уже было
  зафиксировано как Low в SPEC-ревью и признано доказуемым только чтением
  кода.
- **`prefers-reduced-motion: reduce` живьём** — подтверждено чтением diff
  (блок не тронут, новый CSS не содержит `transition`/`animation`), не
  отдельным browser-прогоном с эмуляцией медиа-фичи.
- **`npm run golden:accept`** — не запускал и не должен: принятие baseline
  (в т.ч. новой сцены `decor-color-popover-desktop-en`) принадлежит
  пре-бета этапу на полном Linux CI-артефакте, не циклу код-ревью.
- **Полный `node demo/smoke_*.mjs` набор (127 файлов)** — не запускался
  целиком: diff касается ровно одной поверхности (`hp-color-opacity`),
  прогнан только относящийся к ней `smoke_color_picker.mjs` плюс golden
  целиком (гейт «по необходимости» — рендер/стили).
- **Bundle size budget** — issue не называет числовой бюджет (в отличие от
  #57); не оценивал raw/gzip дельту отдельно, только сверил байт-в-байт
  идентичность трёх копий и совпадение SHA-256 с хендоффом автора.

## Вердикт

Жёлтый. High: 0, Medium: 1 (→ [#194](https://github.com/Matysh/houseplan-card/issues/194)), Low: 0.
AC1, AC2, AC4, AC5 выполнены и доказаны исполнением, с личной проверкой
falsifiability для обоих прогнанных тестов. AC3 выполнена частично: light/
dark читаемость трека и forced-colors fallback подтверждены, но
задекларированное в этом же AC «thumb остаётся различимым» не
выполняется в диапазоне hue ~195°–260° на Chromium — единственном
исполняемом в этом проекте движке — что прямо воспроизведено скриншотами в
ходе ревью, а не предположено. Это ровно тот сценарий, который сама задача
предвидела в своей риск-таблице и не закрыла кодом. Находка не блокирует
(функциональность и три остальных AC не страдают, диапазон — суб-часть
одного критерия), поэтому не High; заведена отдельным issue #194 согласно
процессу. Жёлтый, а не зелёный — потому что реализация не полностью решает
заявленный в AC3 сценарий, даже при том что формальные шаги плана
автотестов пройдены.
