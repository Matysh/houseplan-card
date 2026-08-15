# Issue #62 — реестр языков и масштабируемая i18n-инфраструктура

- **Issue:** https://github.com/Matysh/houseplan-card/issues/62
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P3
- **Тип:** tech-debt, обычный продуктовый трек
- **Пользовательское изменение:** нет для существующих English/Russian установок

## 1. Контекст

House Plan сейчас поставляет английский и русский словари. Формально строки
вынесены в `src/i18n/*.json`, но список языков продублирован в
`src/i18n.ts`, `src/editor.ts`, `test/i18n.test.mjs` и backend translations.
Добавление третьей локали поэтому нельзя проверить одной общей процедурой.

Задача подготавливает инфраструктуру до выбора следующего языка. Она не должна
изменить язык ни у одного существующего пользователя и не должна добавлять
асинхронный пустой первый кадр.

## 2. Цели

1. Сделать один frontend registry источником кодов, словарей и native labels.
2. Вывести `Lang`, language resolution и editor options из registry.
3. Расширить parity gate на каждый зарегистрированный словарь и backend locale.
4. Описать минимальный contribution flow и ограничения текущей подстановки.
5. Оставить проверяемую границу для будущего code splitting, не внедряя его
   раньше появления третьей локали.

## 3. Не входит в задачу

- добавление немецкого или любого другого языка;
- выбор следующей локали по предполагаемой географии;
- Weblate/Crowdin или другой внешний сервис;
- RTL и зеркалирование геометрического UI;
- локализация всей пользовательской документации;
- изменение английских и русских формулировок;
- асинхронная загрузка словаря при двух текущих локалях.

## 4. Канонический frontend registry

В `src/i18n/registry.ts` вводится статически анализируемый registry. Одна запись
содержит:

```ts
interface LanguageEntry {
  code: string;
  nativeLabel: string;
  dictionary: Record<string, string>;
}
```

`en` остаётся обязательной fallback-записью. `Lang` выводится из ключей
registry, а не перечисляется вручную. Registry экспортирует:

- упорядоченный список кодов для UI;
- O(1) lookup по коду;
- английский fallback dictionary;
- native label, который не зависит от активного языка.

До третьей локали registry использует обычные статические JSON imports. Это
сохраняет синхронный `t()` и нынешний первый кадр. Динамический import не должен
быть спрятан за `Promise` внутри существующего `t()`.

Добавление локали после этой задачи требует одного JSON-словаря и одной записи
registry. `src/editor.ts`, `langOf()` и тесты больше не редактируются.

## 5. Разрешение языка

`langOf(hass, configLanguage)` работает детерминированно:

1. валидный явный `configLanguage` побеждает;
2. для HA locale проверяется нормализованный exact tag;
3. затем primary subtag до первого `-` или `_`;
4. иначе возвращается `en`.

Сравнение регистронезависимое. Например, `ru-RU` и `ru_RU` разрешаются в `ru`,
если региональная запись отсутствует. Неизвестное явное legacy-значение не
падает: оно трактуется как Auto и проходит HA locale → English fallback.

`t()` и `tr()` сохраняют текущую цепочку `selected dictionary → en → key` и
существующий `subst()` без изменения plural semantics.

## 6. Language selector

Visual editor строит options из registry в стабильном порядке:

1. `Auto`;
2. зарегистрированные языки в порядке registry.

Подпись языка — native label (`English`, `Русский`), поэтому добавление языка не
требует `editor.lang_<code>` в каждом словаре. Существующие сохранённые
`language: en|ru` читаются без миграции. Неизвестное значение показывается как
Auto и не перезаписывается до явного сохранения пользователем.

## 7. Parity gate

`test/i18n.test.mjs` больше не содержит пары `en/ru`. Gate читает тот же
машиночитаемый список registry либо скомпилированный pure export и проверяет:

- registry code уникален и нормализован;
- у каждой записи есть непустой dictionary и native label;
- каждый frontend JSON зарегистрирован и у каждой записи есть ровно один JSON;
- key set каждой локали равен English;
- значения непусты;
- placeholders совпадают с English;
- help body/aria contract проверяется для всех локалей;
- в `custom_components/houseplan/translations/` есть те же locale codes и нет
  незарегистрированного файла.

`src/i18n/registry.ts` добавляется в `tsconfig.test.json`, если тест использует
скомпилированный export. Тест не парсит TypeScript регулярным выражением.

## 8. Будущий lazy-loading seam

При двух локалях словари остаются eager: это дешевле и не создаёт нового
loading/error lifecycle. Registry проектируется так, чтобы следующая отдельная
задача могла заменить `dictionary` на loader и вынести locale chunks.

До такого перехода должны быть отдельно определены:

- синхронный English bootstrap;
- атомарная смена языка без смешанного кадра;
- offline/HACS cache и ошибка загрузки;
- bundle naming и cache busting;
- отсутствие network request для English fallback.

Эти решения не реализуются и не тестируются в #62. Упоминание «ленивых
словарей» в названии означает подготовленную границу, а не скрытый async diff.

## 9. Backend и документация

Backend следует HA convention и продолжает хранить отдельные JSON. #62 не
создаёт runtime dependency Python backend от TypeScript registry; parity test
служит связью между двумя наборами.

`CONTRIBUTING.md` получает раздел о переводах:

- файл + registry entry + оба frontend/backend parity gates;
- placeholders нельзя менять или переводить;
- `subst()` не поддерживает plural rules, поэтому строки формулируются без
  грамматической зависимости от счётчика;
- English documentation остаётся основной, Russian — поддерживаемой legacy;
- RTL требует отдельного product issue.

Докстрока `src/i18n.ts` приводится в соответствие реальному contribution flow.

## 10. Совместимость и безопасность

- config schema и stored values не меняются;
- `en` и `ru` должны давать те же строки для каждого существующего ключа;
- первый render остаётся синхронным;
- CSP/network поверхность не меняется;
- HTML не строится из native label или перевода как unsafe markup;
- неизвестный locale всегда безопасно падает в English.

## 11. Acceptance criteria

1. `Lang`, `langOf()` и language selector получают список языков только из
   одного frontend registry.
2. Добавление fixture locale требует JSON + одной registry entry и автоматически
   попадает во все parity проверки и selector.
3. Exact tag, primary subtag, explicit config и English fallback покрыты unit.
4. English/Russian keys, placeholders и видимый текст не изменены.
5. Unknown saved language не ломает editor/card и не перезаписывается без Save.
6. Frontend и backend locale file sets сверяются с registry.
7. При обычной работе нет locale fetch, loading flash или нового Promise path.
8. CONTRIBUTING и докстрока описывают фактический flow и plural limitation.

## 12. План тестирования

### Unit

- exact/primary/fallback locale matrix;
- case and `_` normalization;
- invalid explicit config;
- registry uniqueness и English presence;
- dictionary/file/backend parity;
- placeholder/help-key parity для всех entries;
- generated selector order и native labels.

### Интеграция

- visual editor round-trip Auto/en/ru;
- HA locale `ru-RU` без явного config;
- неизвестный HA locale → English;
- fixture third locale доказывает отсутствие hardcoded `en/ru` в gate.

### Регрессия

- `npm run typecheck`;
- полный unit suite;
- production build и bundle smoke для English/Russian.

Golden, browser visual smoke, backend HA harness и performance profile не нужны:
существующие пиксели, backend runtime и eager bundle topology не меняются.

## 13. План реализации

1. Выделить registry и вывести из него `Lang`/lookups.
2. Переписать `langOf()` и editor options.
3. Перевести parity tests на registry и включить backend file-set check.
4. Обновить CONTRIBUTING и i18n docstring.
5. Запустить typecheck, unit и build; проверить production bundle на en/ru.

## 14. Release-артефакты

- **Changelog:** не нужен, поскольку пользовательское поведение и строки не
  меняются (`User-Visible: no`).
- **User guide:** не меняется.
- **Developer docs:** `CONTRIBUTING.md` и комментарий i18n обязательны.
- **Golden/screenshots:** не требуются.
- **Performance/security:** достаточно production build и доказательства, что
  сетевой locale-loading не появился.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Third locale не попадает в gate | registry-driven fixture и file-set parity |
| Unknown locale меняет старый fallback | полная resolution matrix |
| Registry добавляет async flash | eager-only контракт #62 |
| Native label требует переводов | self-name хранится в registry |
| Backend/frontend расходятся | CI file-set check |

Откат удаляет registry abstraction и возвращает прежние imports без миграции
данных. Словари и сохранённый config при этом остаются совместимыми.

## 16. Принятые технические предположения

- code splitting откладывается до отдельной задачи с третьей локалью;
- native labels являются доверенными compile-time literals;
- порядок registry определяет порядок selector;
- документация не размножается по числу локалей в рамках #62.
