# CODE-REVIEW-62-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/62
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 (первый код-ревью раунд;
  спецификация уже прошла свои r1/r2, но код-ревью считает бюджет отдельно)
- **SHA материала:** `6540474ff527fdab39c315bbb04a28ab33683c9d` (=`git rev-parse HEAD`,
  совпадает с последним коммитом `origin/dev..HEAD`)
- **Диапазон:** `git log --oneline origin/dev..HEAD` (6 коммитов, два ТЗ-ревью +
  спецификация + реализация), `git diff origin/dev...HEAD` (15 файлов,
  +1167/−330)

## Скоуп

Задача выводит единый typed registry языков (`src/i18n/registry.ts`) как
источник `Lang`, словарей, native label и порядка; переводит `langOf()`/`t()`/
`hasTranslation()` и visual-editor selector на него; расширяет
`test/i18n.test.mjs` на registry-driven file-set/key/placeholder/help parity
между `src/i18n/*.json` и `custom_components/houseplan/translations/*.json`;
обновляет `CONTRIBUTING.md` (раздел Translations) и комментарии
`src/i18n.ts`/`src/types.ts`. Первая строка `docs/SCOPE.md`, которую закрывает
задача, — J6 «Keep the plan true as the home evolves» опосредованно (это
инфраструктура contribution flow, сам продукт для en/ru не меняется; ценность
пользователю — 2/10, разработке — 7/10 по аналитике issue).

Не входит и не тронуто: добавление нового языка, lazy loading, RTL, plural
rules, связка backend↔frontend registry — всё согласно §5 ТЗ.

## Как проверялось

Гейты прогнаны сам (зелёного Validate на этом SHA нет):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit-тесты | `npm test` | green: `# tests 1415 / pass 1414 / skipped 1` (у автора в хендоффе 1413/2 — расхождение в count skipped/passed воспроизводимо окружением: `test/process-gate.test.mjs` пропускает под-тесты в зависимости от доступности `git`/`gh`-стаба; итоговое число тестов и провалов совпадает — 0 fail) |
| Build + bundle sync | `npm run build`; `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green: оба файла дают идентичный SHA-256, `git status --short` после пересборки пуст (закоммиченный бандл побайтово совпадает со свежей сборкой) |
| Docs fingerprint | `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» |
| `git diff --check` | — | green, конфликтов пробелов нет |

Не прогонял и почему:

- **`npm run invariants`** — diff не трогает геометрию/`layout`/`marker.space`/
  `open_spans`; ни одно из трёх соответствий (#253/#254/#258-259) не
  применимо, гонять не на чем.
- **Browser smokes** — `node scripts/smoke-select.mjs --base origin/dev --head
  HEAD`: 194 смока, символы на изменённых строках дают только 18 «слабых»
  совпадений через одно общее имя `_config` (встречается почти в каждом
  смоке редактора) и явный НЕОПРЕДЕЛЁННОСТЬ-вердикт по всем реальным новым
  символам (`LANGUAGE_REGISTRY`, `languageOptions`, `languageEntry`,
  `resolveLanguageCode`, `normalizeLanguageTag` и др. — ни разу не встречаются
  ни в одном `demo/smoke_*.mjs`). Просмотрел вручную единственный смок, что мог
  бы задеть language-selector по смыслу (`demo/smoke_general_settings.mjs`) —
  он не трогает поле `language` вовсе. Само ТЗ (§11) заранее и обоснованно
  исключает browser smoke: пиксели/сценарии существующих экранов не меняются,
  доказательство AC5/AC6 — unit + source diff. Решение: не прогонять,
  единственный экран, который теоретически мог задеть selector визуально
  (device-editor doc-screenshot), проверил напрямую ниже.
- **`npm run golden:verify`** — ТЗ и diff не меняют рендер/геометрию/стили;
  единственный изменившийся PNG (см. ниже) проверен вручную побайтово через
  декодированный RGBA, а не через golden gate.
- **`python -m pytest tests_backend -q`** — diff не трогает
  `custom_components/**/*.py` (только `translations/*.json`, не Python).
- **Performance-профили** — не названы в AC, diff не касается чувствительных
  к перфу путей.

Отдельная ручная проверка единственного изменившегося PNG
(`docs/images/06-device-editor.png`, `297802→297803` байт, `imageSha256`
поменялся): декодировал оба варианта (`origin/dev` и `HEAD`) через Pillow в
RGBA и сравнил `ImageChops.difference` — `bbox` пуст, т.е. видимое содержимое
пиксель-в-пиксель идентично; изменился только байтовый поток PNG (пере-кодирование
при пересборке демо-фикстуры), не картинка. Это тот же паттерн, что
зафиксирован в `docs/reviews/CODE-REVIEW-184-r1.md`,
`CODE-REVIEW-176-r1.md`, `CODE-REVIEW-198-r2.md`, `CODE-REVIEW-205-r2.md` —
известный шум пересъёмки этого конкретного скриншота, не находка.

## Находки

### High — 1

**H1. `languageEntry()`/`LANGUAGE_BY_CODE` не самосогласованы с
case-insensitive контрактом, который сам registry документирует и тестирует
на примере `pt-BR`; `t()`/`hasTranslation()` для канонического кода со
смешанным регистром молча возвращают English.**

`src/i18n/registry.ts`:

```ts
const LANGUAGE_BY_CODE = new Map<string, LanguageEntry>(
  LANGUAGE_REGISTRY.map((entry) => [entry.code, entry]),   // ключ = entry.code КАК ЕСТЬ
);
export function normalizeLanguageTag(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replaceAll('_', '-').toLowerCase()        // значение нормализуется
    : '';
}
export function languageEntry(value: unknown): LanguageEntry | undefined {
  return LANGUAGE_BY_CODE.get(normalizeLanguageTag(value));  // ключ ищется по нормализованному виду
}
```

`src/i18n.ts` строит `t()`/`hasTranslation()` поверх этой же функции:

```ts
export function t(lang: Lang, key: Key, vars?): string {
  const dictionary = languageEntry(lang)?.dictionary;
  return subst(dictionary?.[key] ?? FALLBACK_DICTIONARY[key] ?? key, vars);
}
```

Карта индексируется точным `entry.code` (canonical spelling, например
`pt-BR` — именно так, с заглавной `BR`, требует §6.4 ТЗ и то же самое
демонстрирует `CONTRIBUTING.md`, который сам этот PR добавляет: «for example,
`fr` or `pt-BR`»), а искомое значение всегда нормализуется в lower-case
(`normalizeLanguageTag`). Для `en`/`ru` совпадение случайное — оба кода уже в
нижнем регистре. Для любого кода с не-lowercase каноническим написанием
поиск промахивается.

**Воспроизведение** (буквальная копия алгоритма `registry.ts`, выполнено
`node`, а не только прочитано):

```js
const LANGUAGE_REGISTRY = [{ code: 'en' }, { code: 'pt-BR' }];
const normalizeLanguageTag = (v) => typeof v === 'string' ? v.trim().replaceAll('_','-').toLowerCase() : '';
const LANGUAGE_BY_CODE = new Map(LANGUAGE_REGISTRY.map((e) => [e.code, e]));
const languageEntry = (v) => LANGUAGE_BY_CODE.get(normalizeLanguageTag(v));
console.log(languageEntry('pt-BR'));   // → undefined
```

Результат: `undefined`.

**Почему это блокирует, а не просто мелочь на будущее.** Единственная
продуктовая причина существования #62 — «contributor добавляет словарь и одну
запись реестра, а сборка сама подключает язык» (ТЗ §1, §6.1, `CONTRIBUTING.md`
раздел Translations, добавленный этим же коммитом). `resolveLanguageCode()`
(отдельная, правильно нормализованная map) корректно вернёт `Lang = 'pt-BR'`
— это подтверждает и собственный unit-тест автора
(`test/i18n.test.mjs`, `resolver supports exact, primary...`, кейс
`{ explicit: 'pt_BR', ha: 'ru-RU', expected: 'pt-BR' }`). Но как только этот
`Lang` дойдёт до `t()`/`hasTranslation()` — а это единственный путь, которым
карточка реально показывает строки — словарь `pt-BR` не находится, и **весь
интерфейс для этого языка молча откатывается на English** без ошибки,
падающего теста или видимого сигнала. Это ровно тот сценарий, который
`CONTRIBUTING.md` (этим же PR) объявляет штатным путём добавления языка, и
именно `pt-BR` — заявленный в ТЗ и тестах канонический пример. Ни один
существующий тест это не ловит: unit на резолвер проверяет только
`resolveLanguageCode`, а parity-тесты `test/i18n.test.mjs` используют
`LANGUAGE_REGISTRY` напрямую (`dictionaries.get(code)`), а не `languageEntry`/
`t()`, поэтому обходят баг стороной.

Сегодняшний рантайм (en/ru) не затронут — оба кода нижнего регистра, поэтому
AC7 (unchanged English/Russian) не нарушен, и это не регрессия для текущих
пользователей. Но это дефект в самом registry-модуле, который является
предметом issue, обнаруживается только чтением (не покрыт ни одним тестом
задачи) и превращает документированный «однострочный» contribution flow в
скрытую ловушку для первого же контрибьютора, который добавит язык с
заглавной буквой в регионе — то есть в большинство реальных кандидатов
(`pt-BR`, `zh-Hans`, `zh-Hant`, `es-419` и т.п.).

**Возможное исправление** (не мой мандат — правок кода не делаю, но фиксирую
направление для автора): ключевать `LANGUAGE_BY_CODE` нормализованным кодом —
`new Map(LANGUAGE_REGISTRY.map((entry) => [normalizeLanguageTag(entry.code),
entry]))` — тогда `languageEntry()` снова самосогласован с
`resolveLanguageCode()`, а `LanguageOption`/selector (которые обходят
`languageEntry` для зарегистрированных кодов и не задеты этим багом) не
меняются.

## Проверено чтением/исполнением и признано корректным

- **AC1** (registry как единственный источник `Lang`/словарей/native
  label/порядка) — **тестом + чтением**. `npm test` зелёный;
  `LANGUAGE_REGISTRY` — единственное место, откуда выводятся `Lang` (`src/i18n.ts:11-18`),
  словари (`t()`), native label и порядок (`languageOptions`,
  `src/i18n/registry.ts:70-88`). Грепом по `src/*.ts` подтвердил отсутствие
  оставшихся ручных `DICTS`/прямых импортов `i18n/en.json`/`i18n/ru.json` и
  веток по конкретному `'ru'`/`'en'` вне `i18n.ts`/`registry.ts`.
- **AC2** (exact/primary/`_`/case/explicit/invalid/fallback матрица) —
  **тестом**. `test/i18n.test.mjs` тест «resolver supports exact, primary,
  explicit and fallback paths» — 8 кейсов, тест умеет падать: локально
  инвертировал один ожидаемый результат (`expected: 'ru'` → `'en'` в кейсе
  `explicit: 'RU'`) — тест немедленно упал, вернул как было.
- **AC3/AC4** (frontend/backend file-set и key/placeholder/help parity
  из registry) — **тестом**. `test/i18n.test.mjs` читает оба каталога через
  `readdirSync` и сверяет с `LANGUAGE_REGISTRY`; `ls src/i18n/*.json
  custom_components/houseplan/translations/*.json` подтверждает ровно
  `en.json`/`ru.json` в обоих местах, `git diff` словарей пуст (AC7).
- **AC5** (selector: порядок Auto→registry, без ручного списка) —
  **чтением + тестом**. `src/editor.ts:98-104` вызывает
  `languageOptions(t(L,'editor.lang_auto'), this._config?.language)`; grep по
  `src/editor.ts` не находит `'en'`/`'ru'` литералов в схеме selector. Тест
  «editor options follow registry order» проверяет форму результата.
- **AC6** (неизвестный сохранённый код → временная option, не ломает
  card/editor, не затирается несвязанным изменением) — **чтением + тестом**.
  `languageOptions()` добавляет одну хвостовую option с сырым значением, если
  оно не среди зарегистрированных (`src/i18n/registry.ts:80-87`, покрыто
  тестом `editor options ... preserve unknown raw values`, включая
  нормализуемый край-кейс `' RU '`). Прочитал `_valueChanged`
  (`src/editor.ts:151-158`) и разбиение `<ha-form>` на два `schema.slice(...)`
  (`src/editor.ts:141-147`, не менялось этим diff'ом) — `language` живёт во
  втором `<ha-form>`, поэтому `value-changed` от первой формы (`title`/
  `floor`/`default_floor`) не содержит ключ `language` вовсе, и merge
  `{...this._config, ...ev.detail.value}` его не стирает; `value-changed` от
  второй формы всегда переносит текущее (в т.ч. неизвестное) значение поля
  language, потому что `.data` формы — это `_formData`, инициализированная тем
  же сырым значением. Runtime: `langOf()` для незарегистрированного
  `configLang` естественно проваливается в HA-locale→English через тот же
  `resolveLanguageCode`, что и AC2. Card/houseplan-card.ts не менялся —
  вызовы `langOf(this.hass, this._config?.language)` там уже были
  универсальными.
- **AC7** (en/ru значения и видимый selector не меняются) — **тестом +
  чтением**. `git diff origin/dev...HEAD -- src/i18n/en.json src/i18n/ru.json
  custom_components/houseplan/translations/` пуст. Единственный изменившийся
  скриншот (`06-device-editor.png`) проверен побайтово декодированным RGBA —
  идентичен (см. «Как проверялось»).
- **AC8** (нет locale fetch/dynamic import/Promise-based пути, нет нового
  первого пустого кадра) — **чтением + сборкой**. `registry.ts` использует
  только статические `import ... with { type: 'json' }`; `grep -n "import("
  dist/houseplan-card.js` — пусто, бандл остаётся одним файлом
  (`ls dist/` → один `houseplan-card.js`), пересборка байт-в-байт совпадает с
  закоммиченной.
- **AC9** (CONTRIBUTING и комментарии описывают фактический flow, plural
  limitation) — **чтением**. Новый раздел Translations в `CONTRIBUTING.md`
  описывает 3-частный flow, placeholders-контракт и ограничение `subst()` на
  plural; устаревшая строка Ground rules «one JSON file + registering it in
  `src/i18n.ts`» заменена ссылкой на раздел — проверил, что второй
  противоречащей формулировки нигде в репозитории не осталось
  (`grep -rn "registering it in\|Adding a language ="` — только исторические
  документы ревью и changelog-запись за старую версию, не текущий процесс).
  `src/i18n.ts` докстрока и `CardConfig.language` комментарий (`src/types.ts`)
  приведены в соответствие.
- **Трейлеры и changelog.** Все 6 коммитов несут `Issue: #62` и
  `User-Visible: no`; changelog-файлы не тронуты — согласовано с ТЗ §14
  (защитное отображение неизвестного кода признано compatibility guard, не
  user-facing изменением, решение принято и зафиксировано ещё на этапе
  зелёного ревью ТЗ r2, technic re-litigation не провожу).
- **Класс изменений и ветка.** Диапазон — class A (`src/**`) + B (`test/**`,
  `tsconfig.test.json`) + C (`docs/**`, `CONTRIBUTING.md`) + D (`dist/**`,
  `custom_components/houseplan/frontend/houseplan-card.js`, регенерированный
  скриншот) — без нарушений границ; issue уже был `S5`+ до правок кода.

## Чего не проверял

- Golden/browser-смоки в полном составе — не запускал; обоснование выше
  (это предрелизный гейт, не гейт код-ревью, и smoke-select не нашёл ни
  прямой, ни зарегистрированной связи).
- Backend Python HA harness — diff не касается `.py`.
- Ручное открытие визуального редактора в браузере (нет ручного тестирования
  в цикле по контракту процесса) — заменено чтением `editor.ts`/
  `registry.ts` и юнит-тестами на чистых helper-функциях.
- Поведение с третьим реальным языком в production — по ТЗ намеренно не
  вводится в этом issue; H1 обнаружен на синтетическом воспроизведении
  логики модуля, а не на реальной третьей локали.

## Вывод

AC1–AC9 в основном доказаны — либо падающим-способным тестом, либо чтением
с явной пометкой. Но H1 — реальный, воспроизведённый исполнением дефект в
самом registry-модуле, который является предметом issue: он не портит
сегодняшний en/ru рантайм, однако молча ломает ровно тот «добавь JSON + одну
запись» flow, который #62 и `CONTRIBUTING.md` (этим же PR) объявляют
результатом задачи, для любого канонического кода со смешанным регистром —
и ни один из добавленных тестов его не ловит. High блокирует независимо от
того, что видимое поведение en/ru не пострадало.

---

**Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 1 · Medium: 0 → в задаче**

Документ: `docs/reviews/CODE-REVIEW-62-r1.md` (публикуется шагом конвейера из
`/home/runner/work/_temp/review-document.md`).
