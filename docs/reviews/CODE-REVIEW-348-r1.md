# CODE-REVIEW-348-r1

- **Issue:** #348 — i18n: добавить полную немецкую локализацию интерфейса
- **Ветка / SHA на момент ревью:** `issue/348-german-localization` · `837acec7475270c657962f7480d61559908d824c`
- **ТЗ:** `docs/specs/348-german-localization.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-348-r1.md`)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4
- **Материал:** `git log --oneline origin/dev..HEAD` (4 коммита) и `git diff origin/dev...HEAD` (52 файла)

Ветка перед ревью была ребейзнута конвейером на `origin/dev` (только doc/asset-конфликты
в сгенерированных деревьях, разрешённые пересборкой). Merge-base с `origin/dev` совпадает
с текущим `origin/dev` tip — это первый настоящий разбор кода задачи, полный, не по
дельте (§7.2, §2.10 к этому раунду неприменим: цикл первый).

## 1. Скоуп

Четыре коммита:

1. `f2024fae` docs: specify German localization — ТЗ (класс C, `User-Visible: no`)
2. `60c68376` docs: review document for #348 — артефакт ревью ТЗ (класс C, `User-Visible: no`)
3. `d0a3077d` feat: add complete German localization — вся продуктовая правка
   (класс A/B/D, `User-Visible: yes`, оба changelog в этом же коммите)
4. `837acec7` fix: keep locale gate within view budget — правка после первого
   упора в initial-View budget (класс A/B/D, `User-Visible: no`, обоснованно: только
   внутреннее объединение двух WeakSet-трекеров в один, видимого поведения не меняет)

Трейлеры на всех четырёх корректны (`Issue: #348`, ровно один `User-Visible:`),
`User-Visible: yes` идёт вместе с правкой обоих `docs/CHANGELOG*.md` в одном коммите
(`d0a3077d`). Ветка `issue/348-german-localization` соответствует номеру issue.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, 0 ошибок |
| Unit/tooling | `npm test` | green — 1457 тестов, 1456 pass, 1 skipped, 0 fail (`npm run inventory` подтверждает те же 1457) |
| Build + bundle sync | `npm run build && npm run bundle:sync` | green; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `diff -rq dist/houseplan-assets custom_components/houseplan/frontend/houseplan-assets` — пусто |
| Budget | `npm run bundle:budget` | green — initial View **255 986 / 256 000 B** gzip (запас всего 14 B, см. находку L2 ниже), lazy editor 131 831 B, lazy locale 21 875 B |
| Docs fingerprint | `node scripts/check-docs.mjs` | green — «Documentation checks passed (7 files, 10 external links)» |
| Smoke-selector | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ — инструмент не подтвердил связь с `smoke_german_locale.mjs` вопреки записи в `scripts/smoke-links.mjs`; прогнал целевой смок напрямую, т.к. он назван в AC3-AC5 |
| Целевой smoke | `node demo/smoke_german_locale.mjs` | green — все 8 assertions (см. §3) |
| golden:verify | `npm run golden:verify` (полный набор — визуальный diff во многих файлах i18n) | 129 passed, 2 `missing-baseline` — новые German-сцены (ожидаемо, приёмка эталонов не входит в код-ревью), **4 `different` + 3 `missing-baseline`** на НЕ-немецких сценах — см. §4, подтверждено не багом этой задачи |
| Backend | `python -m pytest tests_backend -q` | **не прогнан** — в этом окружении нет `pytest`/`.venv-backend`; продуктовый `.py`-код не менялся (только новый `custom_components/houseplan/translations/de.json`), его key/placeholder-парность с `en`/`ru` доказана Node-тестом (`test/i18n.test.mjs`, «backend dictionaries preserve the English structure and placeholders»), прошедшим в `npm test` |
| `git diff --check` | `git diff --check origin/dev...HEAD` | green |
| Model invariants | — | не применимо: diff не трогает геометрию, `layout`, `marker.space`, `open_spans` или толщину стен |

## 3. AC — разбор

- **AC1 (полный key set).** `npm test` → `i18n: every registered dictionary carries the
  English key set`, `i18n: registry matches frontend and backend locale files`,
  `i18n: backend dictionaries preserve the English structure and placeholders`,
  `i18n: placeholders match between languages`, `i18n: every literal help call has body
  and full aria keys in both languages` — все green против реального `de.json` (загружен
  через `ensureLanguage`/`dictionaryFor`, не мимо registry). **Доказано автотестом.**
- **AC2 (locale resolution).** `test/i18n.test.mjs` покрывает `de`, `de-DE`, `de-AT`,
  `de-CH`, explicit `de`, неизвестную locale → `en`. **Доказано автотестом**, тест умеет
  падать: изменил ожидание `de-CH → de` на `en` локально — тест красный, вернул обратно.
- **AC3 (нет смешанного UI).** `demo/smoke_german_locale.mjs` проверяет `btn.save`,
  `btn.cancel`, `space.header`, `lang="de"` на живом `houseplan-card` (View + device
  dialog через `deviceLightControls`). Wiring в `editor.ts`/`space-editor.ts`/
  `space-card.ts` — идентичный трёхстрочный паттерн (`languageRenderGate` + тот же
  `LANGUAGE_RUNTIME`), **проверено чтением, не исполнением**: браузерным смоком покрыт
  только `houseplan-card`, три остальные корневые поверхности (space-card, оба GUI
  editors) — нет. Риск низкий (общая функция, общий runtime, никакой специфики на
  поверхность), но это не автотест.
- **AC4 (без flash).** Cold-путь доказан и юнитом (`LanguageRuntime`/`languageRenderGate`
  в `test/i18n-runtime.test.mjs`), и браузером (`germanColdFrameIsNeutral`,
  `germanCopyCommitsAtomically`). Warm-путь (существующий закоммиченный кадр + смена
  языка на уже смонтированном элементе) доказан юнитом на фейковом хосте и **проверен
  чтением** механизма `noChange` (`node_modules/lit-html`: top-level `render()` явно
  бейлится на `noChange`, значение возвращается прямо из `LitElement.render()` и
  доходит до него без директивы-обёртки — путь корректен), но ни один браузерный тест не
  проверяет его на реальном, уже отрисованном компоненте (`replaceWithGermanCard` в смоке
  всегда создаёт новый элемент, то есть всегда cold). Не блокирую (механизм подтверждён
  чтением библиотеки), отмечаю как L3.
- **AC5 (без deadlock).** Юнит `test/i18n-runtime.test.mjs` — dedupe, retry-once,
  warn-once, fingerprint mismatch — против generic `LanguageRuntime`. Продакшн-синглтон
  `LANGUAGE_RUNTIME`/`settleGerman()` в `src/i18n/registry.ts` — независимая ручная
  реализация того же контракта (см. L1), но её ровно эти сценарии — dedupe
  (`germanLoadsExactlyOnce`, `secondCardReusesPageLocale`), bounded retry
  (`failureRetriesExactlyOnce === 2`), fallback (`failureFallsBackAndUnblocks`),
  warn-once (`failureWarnsOnce`) — прогнаны и зелёные в `demo/smoke_german_locale.mjs`
  против настоящего собранного бандла с перехватом сети (delay/abort). **Доказано.**
- **AC6 (perf/budget).** `npm run bundle:budget` — initial View 255 986/256 000 B,
  German полностью в `lazyLocaleFiles`, EN/RU остаются в initial графе без обращения к
  `de-*.js` (подтверждено смоком: `englishColdViewDoesNotRequestGerman`). **Доказано.**
- **AC7 (доставка).** `dist/houseplan-assets.json`/`custom_components/.../houseplan-assets.json`
  содержат `lazyLocaleFiles: ["houseplan-assets/de-*.js"]` отдельно от
  `lazyEditorFiles`/`lazyOnboardingFiles`; `test/bundle-assets.test.mjs` покрывает и роль,
  и retry-URL подстановку. **Доказано автотестом.**
- **AC8 (layout/a11y).** **Не доказано автоматизированно** — см. Medium-находку M1.
  Golden-сцены для German существуют в `demo/golden/matrix.mjs`
  (`device-dialog-desktop-de`, `german-view-mobile-light`), но у них по канону ещё нет
  эталона (`missing-baseline`, приёмка — предрелизный шаг, не код-ревью), а обещанного
  ТЗ (§11) smoke-измерения переполнения нет вовсе.
- **AC9 (EN/RU compatibility).** `npm test` green (1456/1457), `demo/smoke_german_locale.mjs`
  подтверждает EN не запрашивает de-чанк. Единственная содержательная правка
  рендер-контракта — добавление `!this.hass` в раннюю проверку `space-card.ts`/
  `space-editor.ts` (было только `!this._config`) — **проверено чтением**: в реальном
  жизненном цикле Lovelace/демо-стенда `hass` приходит одновременно с `config`, до этой
  правки язык вообще нельзя было определить без `hass` для gate; риск регрессии низкий,
  автотеста на этот конкретный переход нет.
- **AC10 (документация).** Оба changelog, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`,
  `docs/TESTING.md`, `docs/USER-GUIDE.md`/`.ru.md`, `docs/specs/README.md` — все правки
  на месте, ссылка на #348 есть, `check-docs.mjs` зелёный. **Доказано.**

## 4. Находки

### Medium (в скоупе — возврат автору, отдельный issue не заводится)

**M1. AC8 не имеет обещанного в ТЗ smoke-доказательства «нет overflow».**
`docs/specs/348-german-localization.md` §11 прямо обещает: «German 390 px golden: …
отсутствие overflow измеряется smoke, а не только глазами». Немецкие строки
систематически длиннее английских — это явный риск, названный в самом ТЗ (раздел 13).
Прогнал существующий обобщённый смок `demo/smoke_dialog_footer_width.mjs` — единственный
инструмент в проекте, который уже умеет мерить ширину футера диалога по языкам — и он
**не был расширен на `'de'`** (`for (const language of ['en', 'ru'])`, `grep -n "'de'"`
пусто). Новый `demo/smoke_german_locale.mjs` (единственный файл, где вообще встречается
`'de'` среди `demo/smoke_*.mjs`) не содержит ни одного измерения ширины/scroll/overflow
(`grep -n "scrollWidth\|clientWidth\|getBoundingClientRect\|overflow"` — пусто). Golden-
сцены для German существуют, но у них ещё нет эталона, и даже после приёмки golden — это
визуальное сравнение «на глаз» между эталоном и кадром, а не измеренный порог, который
явно обещан текстом ТЗ. Итог: до пре-релизного golden-принятия у AC8 нет ни одного
пройденного автоматического доказательства «German не ломает layout» — заявленный в
собственном плане тестов инструмент не построен.
*Воспроизведение:* `grep -n "'de'" demo/smoke_dialog_footer_width.mjs` → нет вхождений;
`grep -n "overflow\|scrollWidth\|clientWidth" demo/smoke_german_locale.mjs` → нет
вхождений.
*Как чинится в скоупе:* добавить `'de'` в цикл языков `smoke_dialog_footer_width.mjs`
(тривиально — тот же формат вызова, что уже есть для en/ru) **или** добавить в
`smoke_german_locale.mjs` явную метрику (например `scrollWidth <= clientWidth`) на
представительном диалоге при 390 px. Любой из двух вариантов закрывает находку.

### Low (наблюдения, не блокируют, с записью)

**L1.** `src/i18n/language-runtime.ts` определяет полноценный переиспользуемый класс
`LanguageRuntime` (dedupe/cache/bounded-retry/fingerprint), который юнит-тестируется в
`test/i18n-runtime.test.mjs`, но в продакшене **не используется** — `src/i18n/registry.ts`
реализует тот же контракт вручную и отдельно (`settleGerman`, `germanPending`,
`germanFailed`), жёстко привязанным к одному языку `de`. Дублирование логики без общего
источника истины. Реальный риск снят: production-объект `LANGUAGE_RUNTIME` покрыт
end-to-end браузерным `demo/smoke_german_locale.mjs` (dedupe/retry/fallback/warn-once —
все проверены против настоящего бандла), поэтому не блокирую, но при добавлении
четвёртого языка стоит либо удалить неиспользуемый класс, либо действительно завести его
в `registry.ts` вместо копии логики.

**L2.** Initial View budget после follow-up-коммита — **255 986 / 256 000 B gzip**, запас
14 байт из 256 000. Гейт `bundle:budget` корректно упадёт при малейшей будущей регрессии,
это не дефект задачи, но подушка настолько мала, что практически любая следующая правка
`houseplan-card.ts` потребует новой чистки. Не в скоупе #348 — фиксирую как риск для
следующего изменения.

**L3.** `scripts/bundle-manifest.mjs`: классификация `editorRoots`/`onboardingRoots`/
`localeRoots` сменилась с «всё, что не onboarding — editor» на позитивный список (роль
модуля **или** regex имени файла). Проверил на реальном `dist/houseplan-assets.json` — все
4 текущих dynamic root корректно попадают ровно в одну применимую категорию, живого
дефекта нет. Но конструкция теперь «тихо роняет» будущий пятый тип lazy-root, если он не
совпадёт ни с одной ролью/regex: он останется в `lazyFiles`, но не попадёт ни в
`lazyEditorFiles`, ни в `lazyOnboardingFiles`, ни в `lazyLocaleFiles`, без ошибки. Не
блокирую (это гипотетический будущий случай, не изменяет корректность на этом diff'е).

**L4.** Удалённые из `en.json`/`ru.json` ключи (`title.add_device`, `title.show_all`,
`title.markup_opening`, `marker.preview.demo_activity/demo_notice`, `confirm.merge_rooms`,
`toast.contour_min_edges`, `room.split_header`, `space.orientation`/`orient.*`,
`space.temp_min/max`, `devbar.add/show_all`, `tap.cover`, `confirm.tap_cover`,
`editor.lang_en/ru`) проверены построчным grep по `src/**`, `test/**`, `demo/**` — кроме
одного случая, все действительно мертвы в текущем коде (уже заменены на другие ключи в
более ранних, не связанных с #348 коммитах `dev`). Исключение: `title.add_device`
по-прежнему встречается как строковый литерал в **не тронутом этой задачей** смоке
`demo/smoke_editor_tabs.mjs:168` (`c._t('title.add_device')` внутри assertion
`headerCleanInDev`). Сам ассерт не падает (проверяет отсутствие селектора, а буквальный
ключ-заглушка никогда не совпадёт), но проверяет уже не то, что задумано — тихая деградация
чужого теста. Это застарелая проблема самого `smoke_editor_tabs.mjs` (девбар давно
переехал на `device_inbox.*`, комментарий в тесте уже ссылается на другой issue, #29),
#348 её не создаёт, а лишь убирает последний живой символ. Вне скоупа задачи, оставляю с
записью, не для отдельного issue (стоимость правки — одна строка, но правка чужого файла
не входит в #348).

## 5. Отдельно проверено и не является находкой этой задачи

**Golden-регрессии `geometry-devices-editor-dark`, `device-dialog-mobile-ru`,
`toggle-entity-dialog-mobile-ru`, `device-ripple-color-popover-mobile-ru` (`different`) и
`device-inbox-desktop-en-light`, `device-inbox-desktop-ru-dark`,
`device-inbox-narrow-ru-dark` (`missing-baseline`).** Первая реакция — заподозрить, что
German-изменение сломало рендер девбара (просмотр diff-картинки `geometry-devices-
editor-dark` показал наложенный друг на друга текст на месте кнопок «Add» / «Hidden and
disabled», которые в актуальном коде уже заменены на единую кнопку `device_inbox.*`).
Проверил происхождение: смёрджил рабочий `origin/dev` (`3c6b473c`, тот самый единственный
коммит, на который конвейер перебазировал ветку) в отдельный `git worktree`, собрал его
изолированно (тот же `node_modules`) и прогнал `golden:verify` — **тот же самый набор**
`different`/`missing-baseline` воспроизводится один-в-один на чистом `dev`, без единого
коммита этой задачи. Причина — более ранний, не связанный с #348 коммит
`cab8d128 feat: add device lifecycle catalog`, у которого golden-эталоны ещё не приняты
(отсюда и `--expect-new`-инфраструктура в этой же ветке dev, #350). Это дефект,
существовавший в `dev` до открытия #348, эта задача его не создаёт и не обязана чинить;
не заводится и как отдельный issue этим ревью — он либо уже отслежен по своей задаче, либо
всплывёт на приёмке golden, где и положено фиксировать пробелы `--expect-new`.

**Обратная связь ТЗ ↔ инфраструктура #62.** `LANGUAGE_REGISTRY`, `resolveLanguageCode`,
typed lazy/eager entry — используются ровно так, как описано в принятом ТЗ; сверено с
исходным API #62 по факту (не по слову автора).

## 6. Чего не проверял и почему

- **`python -m pytest tests_backend -q`** — не прогнан: в этом окружении нет `pytest`/
  `.venv-backend`. Продуктовый Python не менялся (только `custom_components/houseplan/
  translations/de.json`); его структурная/placeholder-парность с `en`/`ru` доказана
  Node-тестом, HA-специфичный backend translation API (загрузка через реальный HA) —
  предрелизный/CI-гейт по канону (AGENTS.md: «Windows не может запустить полный HA-
  harness», здесь его тоже нет).
- **`npm run golden:accept`** — не запускал: не входит в код-ревью по канону (принятие
  эталонов — предрелизный шаг с полным Linux CI артефактом).
- **Полный набор `demo/smoke_*.mjs` (196 файлов)** — не прогонял целиком: диффа
  недостаточно широк (`smoke-select.mjs`: 29 изменённых символов, порог «широкого» — 39),
  прогнал только AC-named `smoke_german_locale.mjs` плюс изучил (без прогона)
  `smoke_dialog_footer_width.mjs`, `smoke_editor_tabs.mjs` для находок M1/L4.
- **Браузерные проверки `houseplan-space-card`, GUI editor `houseplan-card`, GUI editor
  `houseplan-space-card` в German** — не прогонял (нет смока, нацеленного именно на них);
  заменил чтением идентичного паттерна wiring (AC3, AC4 выше).
- **Performance-профили** — не запускал: ни ТЗ, ни AC не называют profiler/perf-путь
  затронутым сверх bundle-budget, который прогнан.

## 7. Вердикт

High: 0. Medium: 1, в скоупе задачи (M1) — возврат автору, отдельный issue не заводится.
Low: 4, приняты с записью (L1–L4), правки не требуют.

**Жёлтый.** AC1–AC3, AC5–AC7, AC9, AC10 доказаны; AC4 доказан для критического (cold)
пути и обоснован чтением для warm-пути; AC8 — единственный AC, чьё собственное ТЗ
обещало smoke-измерение переполнения, а получил только (ещё не принятый) golden-эталон.
Это конкретный, дешёво устранимый пробел, а не признак нерабочей реализации в целом.
