# CODE-REVIEW-348-r2

- **Issue:** #348 — i18n: добавить полную немецкую локализацию интерфейса
- **Ветка / SHA на момент ревью:** `issue/348-german-localization` · `4cdd6d7aac0e0a6e24d10c849dcefb5ec11652a5`
- **ТЗ:** `docs/specs/348-german-localization.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-348-r1.md`)
- **Заход:** r2 · блокирующих циклов израсходовано 1/4
- **Материал:** `git log --oneline origin/dev..HEAD` (6 коммитов) и `git diff origin/dev...HEAD` (54 файла, +3117/‑536)

## 0. Почему разбор полный, а не по дельте (§2.10, §7.2)

Формально между r1 и r2 в issue лежит только один коммит, устраняющий Medium
M1 (`4cdd6d7a`, +31/‑5 в `demo/smoke_dialog_footer_width.mjs` и `docs/TESTING.md`).
Но между вердиктом r1 и этим ревью ветка была ребейзнута дважды:

- r1 читал дерево на SHA `837acec7`/`35ea1c4b` — ветку конвейер тогда ребейзнул на
  `origin/dev` @ `e3a4ac76` (только конфликты сгенерированных asset-деревьев).
- После фикса M1 автор явно перебазировал ветку на **сдвинувшийся дальше**
  `origin/dev` @ `0c9cf950` (комментарий автора: «Ветка после фикса перебазирована
  на актуальный `origin/dev` (`0c9cf950`)»); `dev` за это время получил
  `3c6b473c`, `1e341c60`, `0c9cf950` — три коммита, не относящихся к #348.
  SHA `35ea1c4b`, на котором был получен вердикт r1, в текущем дереве
  **не существует** (`git cat-file -t 35ea1c4b` → `fatal: Not a valid object
  name`) — переписан ребейзом целиком, как и весь остальной diff задачи.

`git merge-base origin/dev HEAD` = `0c9cf9503ea55b97d31c3cf58a55f29db9741928` =
`origin/dev` tip: текущая ветка содержит весь `dev`, но как *другое* дерево
коммитов, чем читал r1. По правилу «ребейз на ушедший вперёд `dev` — другой
код» (§7.2, AGENTS.md) это основание для полного разбора независимо от того,
что содержательно нового с точки зрения продукта только один маленький
коммит. Ниже — полный самостоятельный разбор всего diff `origin/dev...HEAD`, а
не только коммита `4cdd6d7a`; раздел 6 отдельно фиксирует, что закрывает
находку M1 и что унаследовано без противоречий.

## 1. Скоуп

Шесть коммитов, все с трейлерами `Issue: #348` и ровно одним `User-Visible:`:

| Коммит | Тема | Класс | User-Visible |
|---|---|---|---|
| `dcbaea2c` | ТЗ | C | no |
| `7a0702ad` | артефакт ревью ТЗ | C | no |
| `12cd8a1a` | вся продуктовая правка (frontend/backend i18n, runtime, manifest, тесты, доки) | A/B/D | **yes** — оба changelog в этом же коммите (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) |
| `5740324b` | правка бюджета initial View | A/B/D | no |
| `37cb4151` | артефакт ревью кода r1 | C | no |
| `4cdd6d7a` | фикс M1: German в `smoke_dialog_footer_width.mjs` | B | no |

Класс D (`dist/**`, `custom_components/houseplan/frontend/**`) присутствует
только вместе с исходниками, которые его порождают — не самостоятельным
коммитом. `demo/golden/baselines/**` в диапазоне не тронут — `Release:`/
`Baseline-Reviewed:` не требуются. Ветка `issue/348-german-localization`
соответствует номеру issue.

## 2. Как проверялось — таблица гейтов

Зелёного Validate на `4cdd6d7a` нет — прогнал дешёвые и целевые гейты сам.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, 0 ошибок |
| Unit/tooling | `npm test` | green — 1461 тестов, 1460 pass, 1 skipped, 0 fail; `npm run inventory` — те же 1461 |
| Build | `npm run build` | green |
| Bundle sync | `npm run bundle:sync` + `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js` + `diff -rq dist/houseplan-assets custom_components/.../houseplan-assets` | все три идентичны байт-в-байт (единственная замеченная разница после пересборки — файловый режим `755→644` у `dist/houseplan-card.js`, откачен `git checkout --`, содержимого не касается) |
| Budget | `npm run bundle:budget` | green — initial View **255 986 / 256 000 B** gzip, lazy editor 131 831 B, lazy locale 21 875 B (совпадает с цифрами хендоффа) |
| Docs fingerprint | `node scripts/check-docs.mjs` | green — «Documentation checks passed (7 files, 10 external links)» |
| Smoke-selector | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | НЕОПРЕДЕЛЁННОСТЬ — 19 смоков со слабой связью через общий символ `_config`, ни одного доказанного совпадения; символы `LANGUAGE_RUNTIME`, `LanguageRuntime`, `languageRenderGate`, `BUILD_FINGERPRINT` и др. не встречаются ни в одном смоке кроме целевого. Решение по строкам — ниже |
| Целевой smoke AC3–AC6 | `node demo/smoke_german_locale.mjs` | green — 8/8 assertions (`englishColdViewDoesNotRequestGerman`, `germanColdFrameIsNeutral`, `germanLoadsExactlyOnce`, `germanCopyCommitsAtomically`, `secondCardReusesPageLocale`, `failureRetriesExactlyOnce`, `failureFallsBackAndUnblocks`, `failureWarnsOnce`) |
| Смок, закрывающий M1 | `node demo/smoke_dialog_footer_width.mjs` | green — 36/36 checks, включая новые `*_de_*`; German оказался самым длинным desktop-набором (spareWidth 177.41 px против EN 240.31 / RU 187.09), что подтверждает: словарь реально загрузился и измерен, а не остался на fallback |
| Model invariants | — | не применимо: diff не трогает геометрию, `layout`, `marker.space`, `open_spans`, толщину стен |
| Backend | `python -m pytest tests_backend -q` | **не прогнан** — в этой среде нет `pytest`/`.venv-backend`. Продуктовый `.py` не менялся (только новый `custom_components/houseplan/translations/de.json`); его key/placeholder-парность с `en`/`ru` доказана Node-тестом `i18n: backend dictionaries preserve the English structure and placeholders` (structural flatten + regex extraction плейсхолдеров), прошедшим в `npm test` |
| golden:verify | — | **не прогонял**: полный визуальный прогон — предрелизный гейт (PROCESS.md §8), а не гейт ревью; r1 уже отдельно доказал, что не связанные с #348 golden-регрессии (`geometry-devices-editor-dark` и др.) воспроизводятся на чистом `dev` — не переисследовал, см. §7 |

**Решение по смок-селектору (обязательная строка на каждую позицию):**
19 файлов со слабой связью — все совпали только по общему `_config`, который
есть почти в каждом смоке карточки; ни один не касается i18n/locale
контракта содержательно. Прогонять их не стал: слабая связь — повод
посмотреть, не обязанность прогонять (инструкция ревью), а тема этих смоков
(color picker, entity dedup, wall junction, taper и т.п.) физически не
пересекается с рендер-гейтом языка. Вместо этого прогнал напрямую
`smoke_german_locale.mjs` (назван в AC3–AC6) и `smoke_dialog_footer_width.mjs`
(инструмент, которым закрыта находка M1, явно назван в фиксирующем коммите
и в `docs/TESTING.md`).

## 3. AC — разбор (полный, не по дельте)

- **AC1 (полный key set).** `npm test`: `i18n: registry matches frontend and
  backend locale files`, `i18n: every registered dictionary carries the
  English key set`, `i18n: backend dictionaries preserve the English
  structure and placeholders`, `i18n: placeholders match between languages`,
  `i18n: every literal help call has body and full aria keys in both
  languages`, `i18n: German catalog keeps the product glossary and has no
  translation sentinels`, `i18n: German values equal to English are
  explicitly reviewed` (точный allowlist — 24 ключа, любой новый совпадающий
  ключ рвёт тест). Дополнительно прочитал `src/i18n/de.json` и
  `custom_components/houseplan/translations/de.json` целиком по выборке
  (delete/confirm/lock/unlock strings, глоссарий из ТЗ §4: Ansicht,
  Planeditor, Geräteeditor, Hintergrundeditor, Bereich, Raum, Wand,
  Trennwand, Säule, Öffnung, Tür/Fenster/Tor, Gerät/Entität, Füllung, Glow,
  Speichern/Abbrechen/Löschen — все присутствуют дословно). Плейсхолдеры
  (`{name}`, `{count}`, `{state}`) сохранены везде, где проверил. Смысл
  опасных действий (`confirm.unlock`, `confirm.delete_*`) переведён точно, без
  ослабления формулировки. **Доказано автотестом + выборочным чтением.**
- **AC2 (locale resolution).** `test/i18n.test.mjs`: явный `de`, `de-DE`,
  `de-AT`, `de-CH` (через `_` и `-`), неизвестная locale → `en`. **Доказано
  автотестом.**
- **AC3 (нет смешанного UI).** `smoke_german_locale.mjs` покрывает
  `houseplan-card` браузером. Проверил сам код четырёх корневых поверхностей
  (`src/houseplan-card.ts:10707`, `src/space-card.ts:765`, `src/editor.ts:117`,
  `src/space-editor.ts:59`) — идентичный трёхстрочный wiring
  (`languageRenderGate(this, LANGUAGE_RUNTIME, langOf(...))` →
  `cold`/`warm`/`ready`) на всех четырёх, без поверхность-специфичных
  отклонений. **Доказано автотестом для одной поверхности, для трёх
  остальных — проверено чтением, не исполнением** (не изменилось с r1: этот
  раунд не касался wiring).
- **AC4 (без flash).** Cold-путь: `test/i18n-runtime.test.mjs` (`locale
  render gate exposes cold/warm states...`) + браузерный `smoke_german_locale`
  (`germanColdFrameIsNeutral`, `germanCopyCommitsAtomically`). Юнит-тест
  подтверждает саму функцию `languageRenderGate` возвращает `'warm'` и
  держит `inert`/атрибуты неизменными, пока хост не обновится
  (`host.updates === 0` при disconnected host). Механизм, которым `render()`
  реально пропускает re-render при возврате `noChange` из `LitElement`, —
  свойство `lit-html`, не код задачи; не нашёл браузерного теста именно
  тёплого переключения на уже смонтированном реальном компоненте (тот же
  пробел, что назвал r1). **Доказано юнитом для gate-функции + чтением
  библиотеки для warm-рендера**, риск низкий и не изменился с r1.
- **AC5 (без deadlock).** `test/i18n-runtime.test.mjs` — dedupe, retry-once,
  warn-once, fingerprint mismatch на generic `LanguageRuntime`; те же сценарии
  для продакшн-синглтона `LANGUAGE_RUNTIME`/`settleGerman()` прогнаны и
  зелёные в `smoke_german_locale.mjs` против настоящего собранного бандла с
  перехватом сети. **Доказано.**
- **AC6 (perf/budget).** `npm run bundle:budget` — 255 986/256 000 B, German
  целиком в `lazyLocaleFiles`; смок подтверждает EN не запрашивает de-чанк.
  **Доказано.**
- **AC7 (доставка).** `dist/houseplan-assets.json` и копия в
  `custom_components/.../houseplan-assets.json` содержат `lazyLocaleFiles`
  отдельно от `lazyEditorFiles`/`lazyOnboardingFiles`; проверил
  `scripts/bundle-manifest.mjs` и `test/bundle-assets.test.mjs` — позитивная
  роль по модулю (`/src/i18n/de.ts`) плюс regex-бэкстоп по имени файла,
  ретрай-URL плагин требует ровно один `DE_RETRY_ASSET_TOKEN`. **Доказано
  автотестом.**
- **AC8 (layout/accessibility) — было M1, теперь доказано.** Прогнал сам
  `demo/smoke_dialog_footer_width.mjs` после фикса: German добавлен в
  desktop-цикл (`['en', 'ru', 'de']`) и в narrow-набор при **320 px**
  (строже требуемых по ТЗ 390 px) для opening/physical/space диалогов.
  Проверки `noHorizontalOverflow` считают реальные `scrollWidth`/
  `clientWidth` поверхности и футера, `buttonsContained` — геометрию каждой
  кнопки относительно внутренних границ футера; это измеренный порог, а не
  сравнение с golden-картинкой на глаз, ровно то, что обещало ТЗ §11. Все 36
  checks green; German — самый длинный desktop-набор, `spareWidth = 177.41 px`
  > 0. Golden-сцены (`device-dialog-desktop-de`, `german-view-mobile-light`)
  по-прежнему без принятого эталона (`missing-baseline`) — ожидаемо, приёмка
  вне код-ревью. **Доказано автотестом.**
- **AC9 (EN/RU compatibility).** `npm test` green; `smoke_german_locale`
  подтверждает EN не запрашивает de-чанк; `smoke_dialog_footer_width`
  подтверждает EN/RU метрики не изменились относительно контрольных
  ассертов. Единственная содержательная правка рендер-гейта — добавление
  `!this.hass` в раннюю проверку `space-card.ts`/`space-editor.ts` —
  не тронута этим раундом, **проверено чтением** (не изменилось с r1).
  **Доказано.**
- **AC10 (документация).** Прочитал сам диффы `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md` (bullet со ссылкой #348, в одном коммите с
  продуктовой правкой), `docs/USER-GUIDE.md`/`.ru.md` (`language` теперь
  `auto, en, ru, de`, абзац про lazy-загрузку и fallback), `docs/TESTING.md`
  (новый раздел явно указывает M1-инструмент), `CONTRIBUTING.md`,
  `docs/ARCHITECTURE.md`. `check-docs.mjs` зелёный. **Доказано.**

## 4. Находки этого раунда

Нет. High: 0, Medium: 0, Low: 0 нового.

## 5. Отдельно проверено и не относится к этой задаче

Golden-регрессии на не-немецких сценах (`geometry-devices-editor-dark`,
`device-dialog-mobile-ru`, `toggle-entity-dialog-mobile-ru`,
`device-ripple-color-popover-mobile-ru`, три `device-inbox-*`) —
воспроизведены r1 байт-в-байт на чистом `origin/dev` в изолированном
worktree, причина — непринятые эталоны несвязанного `cab8d128 feat: add
device lifecycle catalog`. Диапазон `origin/dev` между r1 и r2 добавил только
`--expect-new`-инфраструктуру golden-приёмки (`3c6b473c`, `1e341c60`,
`0c9cf950`) — не тронул ни один файл, имеющий отношение к #348 или к этим
golden-сценам; повторно прогонять этот воркчейн смысла не было, вывод r1
актуален.

## 6. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **M1** (Medium, в скоупе): AC8 не имел обещанного ТЗ smoke-измерения overflow для German | `demo/smoke_dialog_footer_width.mjs` расширен на `'de'` в desktop-цикле и в 320px narrow-наборе (opening/physical/space); измеряет `noHorizontalOverflow` через `scrollWidth`/`clientWidth` и `buttonsContained` через геометрию кнопок | коммит `4cdd6d7a`; сам прогнал `node demo/smoke_dialog_footer_width.mjs` — 36/36 green, German — самый длинный набор, `spareWidth = 177.41 px` |
| **L1** (Low, принято без правки): дублирование `LanguageRuntime`/ручной `LANGUAGE_RUNTIME` | не тронуто, риск снят end-to-end смоком (как и в r1) | `src/i18n/language-runtime.ts` + `src/i18n/registry.ts`, не менялись в этом раунде |
| **L2** (Low, принято без правки): запас budget 14 B | без изменений — 255 986/256 000 B, тот же запас | `npm run bundle:budget`, воспроизвёл сам |
| **L3** (Low, принято без правки): позитивный список ролей в `bundle-manifest.mjs` может тихо не классифицировать будущий 5-й lazy-root | не тронуто, гипотетический будущий случай | `scripts/bundle-manifest.mjs`, перечитал сам — вывод не изменился |
| **L4** (Low, принято без правки, вне скоупа): мёртвый ключ `title.add_device` деградирует ассерт в не связанном `smoke_editor_tabs.mjs` | не тронуто (правка чужого файла вне #348) | `demo/smoke_editor_tabs.mjs:168`, не в diff'е #348 |

## 7. Унаследовано из r1

Формально это полный разбор (§0), поэтому ничего не принято «на слово» — весь
diff `origin/dev...HEAD` перечитан и все дешёвые/целевые гейты перезапущены
лично в этом раунде. Тем не менее не повторял то, что r1 уже установил
изолированным экспериментом и что этот диапазон `dev` не мог задеть:

- **Происхождение golden-регрессий на не-немецких сценах** — вывод r1
  (`docs/reviews/CODE-REVIEW-348-r1.md`, §5, SHA `837acec7`/пересборка
  чистого `origin/dev@3c6b473c` в отдельном worktree) принят без повторного
  воркчейна: три новых коммита `dev` между r1 и r2 (`3c6b473c`, `1e341c60`,
  `0c9cf950`) — это сама `--expect-new`-инфраструктура golden, не изменения
  в затронутых сценах.
- **Правило `noChange`/`lit-html` для тёплого рендера** (AC4) — то же чтение
  библиотеки, что и в r1; код `LitElement.render()`/`noChange` не менялся ни
  в `dev`, ни в этой ветке.

## 8. Чего не проверял и почему

- **`python -m pytest tests_backend -q`** — нет `pytest`/`.venv-backend` в
  этой среде; см. §2, замена — Node-тест структурной/placeholder-парности.
- **`npm run golden:accept` / полная приёмка golden** — вне код-ревью
  (предрелизный шаг с полным Linux CI артефактом).
- **Полный набор `demo/smoke_*.mjs` (196 файлов)** — не прогонял: селектор не
  нашёл ни одной сильной связи (только 19 слабых через общий `_config`),
  диапазон изменения не сопоставим с «широким» диффом; прогнал целевые
  AC-смоки напрямую (§2).
- **Браузерные проверки `houseplan-space-card`, GUI editor `houseplan-card`,
  GUI editor `houseplan-space-card` на German** — нет смока, нацеленного
  именно на них; заменено чтением идентичного паттерна wiring (AC3, §3),
  тот же пробел, что и в r1, не в скоупе фикса M1.
- **Performance-профили** — ни ТЗ, ни AC не называют profiler/perf-путь сверх
  bundle-budget, который прогнан.
- **Повторный worktree-эксперимент по golden-регрессиям на не-немецких
  сценах** — не повторял, см. §7.

## 9. Вердикт

High: 0. Medium: 0 нового (M1 закрыт с измеренным доказательством). Low: 0
нового; L1–L4 из r1 остаются принятыми без правки, без изменений с прошлого
раунда.

**Зелёный.** Все десять AC доказаны — девять автотестом/смоком напрямую,
AC4 (тёплый путь) и AC3 (три из четырёх корневых поверхностей) — чтением
идентичного, не менявшегося в этом раунде кода с низким риском, как и в r1.
Единственный блокирующий пробел прошлого раунда (M1: AC8 без измеренного
smoke-доказательства) закрыт тем инструментом, который сам же и назвало ТЗ, и
я лично воспроизвёл результат — German оказался самым длинным набором и
уложился без overflow с положительным запасом на обеих ширинах. Готово к
очереди на пре-релиз.
