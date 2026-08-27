# Issue #62 — единый реестр языков и масштабируемые проверки i18n

- **Issue:** https://github.com/Matysh/houseplan-card/issues/62
- **Статус документа:** актуализировано 2026-08-28, готово к ревью ТЗ
- **Приоритет:** P3
- **Тип:** tech-debt, полный трек: задача меняет class A i18n и затрагивает
  несколько поверхностей; критерий `small` «одна поверхность» не выполняется
- **Пользовательское изменение:** нет для существующих English/Russian
  установок

## 1. Сценарий

Основной потребитель результата — contributor/maintainer House Plan. На этапе
добавления будущего языка он добавляет словарь и одну запись в реестр, а сборка
сама подключает язык к определению локали, visual editor и проверкам паритета.

Для всех трёх пользовательских персон из `docs/SCOPE.md` поверхность остаётся
той же: карточка и visual editor продолжают синхронно работать на English или
Russian согласно явной настройке либо языку профиля Home Assistant.

## 2. Что человек увидит до и после

Пользователь English/Russian не увидит изменений; будущий переводчик вместо
нескольких несвязанных правок получает один описанный и автоматически
проверяемый путь добавления языка.

## 3. Проблема

Список языков сейчас продублирован в нескольких местах:

- `src/i18n.ts` вручную задаёт `Lang`, imports, `DICTS` и русский fallback;
- `src/editor.ts` вручную перечисляет English/Russian в selector;
- `test/i18n.test.mjs` вручную проверяет только пару `en`/`ru`;
- frontend и backend translation directories никак не сверяются.

Из-за этого новый JSON может не попасть в runtime, selector или gate. Докстрока
`src/i18n.ts` при этом ошибочно обещает добавление языка без правок TypeScript.

Словари уже заметны по размеру, но при двух текущих языках асинхронная загрузка
создала бы новый loading/error lifecycle без пользовательской пользы. Поэтому
lazy loading исключён из #62 и должен стать отдельной задачей одновременно с
добавлением третьей локали или при подтверждённой проблеме размера bundle.

## 4. Цели и scope

1. Ввести один frontend registry как источник кодов, словарей, native labels и
   стабильного порядка языков.
2. Вывести из registry тип `Lang`, language resolution и options visual editor.
3. Расширить i18n gates на все зарегистрированные frontend dictionaries и набор
   backend translations.
4. Описать contribution flow и ограничения текущей подстановки placeholders.
5. Сохранить синхронный первый render и существующее поведение English/Russian.
6. Исправить устаревший комментарий `CardConfig.language` в `src/types.ts`.

## 5. Не входит в задачу

- добавление немецкого или любого другого языка;
- выбор следующей локали по географии пользователей;
- Weblate, Crowdin или другой внешний сервис;
- code splitting, динамический import и сетевой fetch словаря;
- RTL и зеркалирование геометрического UI;
- новая политика локализации пользовательской документации;
- изменение видимых английских или русских формулировок;
- plural rules/ICU MessageFormat;
- связывание Python runtime с TypeScript registry.

Упоминание lazy dictionaries удаляется из заголовка issue: #62 не должно
выглядеть как обещание асинхронной загрузки, которой в acceptance criteria нет.

## 6. Контракт поведения

### 6.1. Registry

В `src/i18n/registry.ts` вводится статически анализируемый реестр. Каждая запись
задаёт:

```ts
interface LanguageEntry {
  code: string;
  nativeLabel: string;
  dictionary: Record<string, string>;
}
```

`en` — обязательная fallback-запись. `Lang` выводится из литеральных кодов
registry, а не поддерживается отдельным union. Registry экспортирует:

- упорядоченный readonly список записей;
- lookup зарегистрированной записи по нормализованному коду;
- тип `Lang`;
- английскую fallback-запись.

При двух локалях используются обычные static JSON imports. Добавление локали
требует её frontend JSON, backend JSON и одной логической записи registry
(включая её static import в том же модуле); `src/editor.ts`, `langOf()` и список
локалей в тестах больше не редактируются.

Существующие `editor.lang_en` и `editor.lang_ru` не используются selector после
рефакторинга, но в рамках #62 не удаляются: задача не смешивает инфраструктуру с
чисткой словарей.

### 6.2. Разрешение языка

`langOf(hass, configLanguage)` работает детерминированно:

1. зарегистрированное явное `configLanguage` побеждает;
2. для HA locale проверяется нормализованный exact tag;
3. затем primary subtag до первого `-` или `_`;
4. иначе возвращается `en`.

Сравнение регистронезависимое, `_` нормализуется в `-`. Например, `ru-RU` и
`ru_RU` разрешаются в `ru`, если отдельная региональная запись отсутствует.
Неизвестное явное legacy-значение не падает: оно трактуется как Auto и проходит
HA locale → English fallback.

`t()` и `hasTranslation()` сохраняют цепочку `selected dictionary → en → key`.
`subst()` и plural semantics не меняются.

### 6.3. Visual editor

Selector строит options в стабильном порядке:

1. локализованный `Auto`;
2. все registry entries в порядке registry.

Подпись языка — compile-time native label (`English`, `Русский`), а не ключ
`editor.lang_<code>` во всех словарях.

Существующие `language: en|ru|''` читаются без миграции. Если в сохранённом
config встретился неизвестный код, selector показывает отдельную временную
option с этим кодом и не меняет config при редактировании другого поля. После
явного выбора Auto/зарегистрированного языка временная option исчезает. Runtime
до такого выбора применяет обычный HA locale → English fallback.

### 6.4. Parity gate

`test/i18n.test.mjs` получает данные из скомпилированного pure registry export,
а не парсит TypeScript регулярным выражением. Для этого `src/i18n.ts` и
`src/i18n/registry.ts` включаются в `tsconfig.test.json`.

Gate проверяет:

- коды являются BCP 47 tags и уникальны после case-insensitive нормализации
  (`_` считается эквивалентом `-`); canonical spelling registry сохраняется в
  selector и точных именах frontend/backend файлов (`pt-BR`, а не принудительно
  `pt-br`);
- `en` существует и является fallback;
- у каждой записи есть непустые `nativeLabel` и dictionary;
- каждый `src/i18n/<code>.json` зарегистрирован и у каждой записи есть ровно
  один такой JSON;
- key set каждой локали равен English;
- значения непусты, placeholders совпадают с English;
- текущий help body/aria contract выполняется для всех словарей;
- набор `<code>.json` в `custom_components/houseplan/translations/` совпадает с
  кодами registry, без незарегистрированных и отсутствующих файлов.

Тестовая fixture с третьей локалью не добавляется в production registry: вместо
этого unit-тесты проверяют generic resolution на искусственном registry/helper,
либо доказывают отсутствие ветвления по `ru` в resolver. Production file-set
gate остаётся только на реально поставляемых локалях.

## 7. UX

Внешний вид selector для Auto/English/Russian и выбранные значения остаются
прежними. Порядок остаётся `Auto`, `English`, `Русский`.

Единственный новый защитный UX — неизвестный сохранённый код виден как временная
option вместо пустого/ложного выбора и не затирается несвязанным изменением.

Новых loading indicators, flashes, requests или error messages нет.

## 8. Модель данных и миграция

Schema и persisted config не меняются. Миграции нет.

- `language: en`, `language: ru`, пустая строка и отсутствие поля сохраняют
  прежний смысл;
- неизвестная строка сохраняется до явного изменения пользователем;
- runtime безопасно использует Auto fallback;
- `CardConfig.language` остаётся `string`, потому что обязан читать будущие и
  неизвестные сохранённые значения; комментарий больше не перечисляет только
  `en|ru`.

## 9. i18n и документация

Новых видимых строк нет. Native labels доверенные compile-time literals.

`CONTRIBUTING.md` получает раздел «Translations»:

- frontend JSON + backend JSON + registry entry;
- placeholders нельзя удалять, добавлять или переводить;
- `subst()` не поддерживает plural rules, поэтому строка должна избегать
  грамматической формы, зависящей от `{n}`;
- добавление языка интерфейса само по себе не создаёт новый комплект
  пользовательской документации; текущие English/Russian документы продолжают
  сопровождаться по действующим правилам проекта;
- RTL — отдельная продуктовая задача.

Существующая строка в `Ground rules` про «one JSON file + registering it in
`src/i18n.ts`» не остаётся рядом вторым контрактом: она заменяется ссылкой на
новый раздел и формулировкой про frontend/backend JSON и
`src/i18n/registry.ts`.

Докстрока `src/i18n.ts` приводится в соответствие реальному flow.

## 10. Acceptance criteria и доказательства

- **AC1.** `Lang`, `langOf()` и options visual editor получают языки из одного
  registry. **Доказательство:** typecheck + unit на registry/options.
- **AC2.** Exact tag, primary subtag, `_`/case normalization, explicit config,
  invalid explicit config и English fallback покрыты матрицей unit-тестов.
  **Доказательство:** unit-тест pure resolver.
- **AC3.** Frontend locale file set, backend locale file set и registry взаимно
  однозначны. **Доказательство:** i18n file-set unit test.
- **AC4.** Каждый зарегистрированный словарь автоматически проходит key,
  non-empty, placeholder и help-key parity. **Доказательство:** registry-driven
  `test/i18n.test.mjs`.
- **AC5.** Selector имеет порядок Auto/English/Русский и строит registered
  options без ручного списка `en`/`ru`. **Доказательство:** unit на pure options
  helper и source diff `src/editor.ts` без ручного списка локалей.
- **AC6.** Неизвестный сохранённый язык не ломает card/editor, использует Auto
  fallback и не затирается изменением другого editor field. **Доказательство:**
  unit для resolver/options/form normalization.
- **AC7.** English/Russian dictionary values и видимый selector не меняются.
  **Доказательство:** git diff словарей + существующие unit/build gates.
- **AC8.** В production bundle нет locale fetch, dynamic import, Promise-based
  translation path или нового первого пустого кадра. **Доказательство:** static
  registry source diff + успешный production build.
- **AC9.** CONTRIBUTING и комментарии описывают фактический contribution flow и
  plural limitation. **Доказательство:** documentation diff.

## 11. План автотестов

### Unit

- registry uniqueness после нормализации, BCP 47 code format, English
  presence/fallback;
- exact/primary/fallback locale matrix, case and `_` normalization;
- invalid explicit config;
- registry-driven dictionary/file/backend parity;
- placeholders и help keys для всех entries;
- selector order/native labels/unknown temporary option;
- сохранение неизвестного значения при несвязанном form change.

### Обязательные локальные gates

```text
npm run typecheck
npm test
npm run build
npm run inventory
```

Browser smoke, golden, backend HA harness и performance capture не требуются:
пиксели, backend runtime, bundle topology и пользовательские сценарии не
меняются. Production build обязателен для подтверждения static bundling.

## 12. Риски

| Риск | Мера |
| --- | --- |
| Locale зарегистрирован не во всех местах | взаимная file-set проверка |
| Resolver меняет старый fallback | полная матрица language resolution |
| Visual editor стирает неизвестное значение | временная option + unit round-trip |
| Рефакторинг добавляет async flash | static imports и запрет async path в AC8 |
| Backend/frontend расходятся | CI parity по обоим каталогам |
| Типы registry превращаются в общий `string` | compile-time `Lang` из `as const` codes |

## 13. Откат

Откат возвращает ручные imports/`DICTS`/selector options. Config schema,
словари и сохранённые значения не меняются, поэтому data rollback не нужен.

## 14. Release-артефакты

- **Changelog:** не нужен (`User-Visible: no`), поскольку English/Russian UX не
  меняется; защитное отображение неизвестного кода — compatibility guard.
- **User guide:** не меняется.
- **Developer docs:** `CONTRIBUTING.md`, комментарий `src/i18n.ts` и комментарий
  `CardConfig.language` обязательны.
- **Generated bundle:** пересобрать и синхронизировать штатно перед code review.
- **Golden/screenshots:** не требуются.

## 15. План реализации

1. Выделить registry и pure helpers resolution/options.
2. Перевести `src/i18n.ts` и `src/editor.ts` на registry.
3. Добавить compatibility handling неизвестного editor value.
4. Перевести i18n tests на compiled registry и включить locale file-set checks.
5. Обновить CONTRIBUTING/comments.
6. Выполнить обязательные gates, собрать и синхронизировать bundle.

## 16. Технические предположения — можно менять на ревью

- `src/i18n/registry.ts` содержит static imports и readonly entries; отдельный
  generated manifest не нужен при двух языках.
- Pure helper для selector может жить рядом с registry, чтобы тесты не зависели
  от Lit/`ha-form`.
- Backend runtime не импортирует и не генерирует registry; связь обеспечивается
  только test gate.
- Code splitting заводится отдельным issue не раньше третьей локали или
  измеримого bundle-size bottleneck.
