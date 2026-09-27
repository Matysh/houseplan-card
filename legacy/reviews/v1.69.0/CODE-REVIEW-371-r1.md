# CODE-REVIEW-371-r1

**Issue:** [#371 — Add French localization files](https://github.com/Matysh/houseplan-card/issues/371)
**Этап:** code (PROCESS.md §2.7)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 2 (лёгкий трек, бюджет §4 = 2)
**SHA на момент ревью:** `3c19ba1881a3fc3bb7f0a504d9ef332c3ccce192`
**База:** `origin/dev`
**Коммиты в диапазоне:**
- `fd673b32` feat: French localization — community contribution by @OUARZA (#371) — `User-Visible: yes`
- `a29d9bc6` test: pin the fr entry to the fr dictionary via a live-bundle mutant (#371) — `User-Visible: no`
- `3c19ba18` test: keep the fr chunk emitted in the #371 mutant (wrong dictionary via en) — `User-Visible: no`

Это первый заход код-ревью для #371 (спек-ревью уже прошло два захода r1/r2 и
закрылось зелёным на этапе `spec`); правило «объём по дельте» (§2.9) на код-этап
не переносится — здесь начинается собственный счётчик циклов и полный разбор.

## Скоуп

Класс A (`src/i18n/fr.json`, `src/i18n/fr.ts`, `src/i18n/registry.ts`,
`custom_components/houseplan/translations/fr.json`) + класс B (`scripts/bundle-manifest.mjs`,
`scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs`, `demo/smoke_french_locale.mjs`,
`demo/smoke_entry_stale.mjs`, `test/i18n.test.mjs`, `test/bundle-assets.test.mjs`) +
класс C (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`) + класс D (три копии бандла, `docs/images/*`,
`docs/images/screenshots.json` — регенерированы `check-docs`/`capture.mjs`
из-за роста `sourceFingerprint` над `src/**`, ожидаемо).

Задача — French как четвёртая (третья ленивая) локаль по контракту реестра
#62, буквальный клон механики German (#348). Соответствует core user job
J1/J4 (`docs/SCOPE.md`): расширяет доступность интерфейса без нового UX-контракта.

## Как проверялось

Прогнано лично, гейты дешёвые, результаты — команда и вывод:

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | чисто, без ошибок |
| Юниты | `npm test` | `# tests 1544 / pass 1543 / fail 0 / skipped 1` (пропуск не связан с задачей — существовал до неё) |
| Сборка | `npm run build` | успех, `dist` создан за 14.5s |
| Синхронизация бандла | `git status --short` после `npm run build` | пусто — закоммиченный `dist` побайтово совпадает с пересобранным; отдельно сверены `dist/houseplan-assets`, `custom_components/houseplan/frontend/houseplan-assets`, `dist/houseplan-assets.json`, `dist/houseplan-card.js` через `diff -rq`/`diff` — расхождений нет |
| Бюджет | `npm run bundle:budget` | `initial View: 273826 B gzip (budget 300000, headroom 26174)`, `lazy locale: 45215 B gzip` — совпадает с числом автора (273 826) |
| Доки-отпечаток | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «НЕОПРЕДЕЛЁННОСТЬ»: `FRENCH_RETRY_ASSET`, `LazyLanguageModule`, `loadFrench` не встречаются ни в одном смоке по имени — см. решение ниже |
| Смок AC3 | `node demo/smoke_french_locale.mjs` (после `npm run bundle:sync`, т.к. стенд был устаревшим) | `OK`, все 5 полей true |
| Смок AC (fallback) | `node demo/smoke_entry_stale.mjs` | `OK` |
| Смок регресс | `node demo/smoke_german_locale.mjs` (немецкая ветка делит код с новой — проверка отсутствия регресса) | `OK`, все 9 полей true |
| Мутант AC5 (дёшево) | `node scripts/mutation-gate.mjs --check --id=french-locale-wrong-dictionary` | `ok   french-locale-wrong-dictionary` (патч ложится на текущий код) |
| Паритет словаря (независимый скрипт, не доверяю заявлению автора на слово) | inline Python: сравнение ключей/порядка/плейсхолдеров `en.json` vs `fr.json` | `en keys 1128, fr keys 1128`, `missing/extra: []`, `order matches: True`, `empty fr values: 0`, `placeholder mismatches: 0` |
| Артефакты не-перевода (независимо) | inline Python: кириллица + сентинелы в `fr.json` | `cyrillic hits: []`, `sentinel hits: []` |
| Allow-list "равно en" (независимо) | inline Python: множество ключей с `en[k]==fr[k]` | ровно те же 22 ключа, что в `test/i18n.test.mjs` allow-list — совпадение полное |
| Паритет бэкенда | inline Python: flatten `custom_components/houseplan/translations/{en,fr}.json` | `en keys 6, fr keys 6, missing/extra: []` |
| Манифест | inline Python по `dist/houseplan-assets.json` | `fr-BSq3jD_I.js` в `lazyLocaleFiles`, отсутствует в `initialViewFiles` |
| Трейлеры | `git log` по трём коммитам | `Issue: #371` и `User-Visible` на всех трёх; `User-Visible: yes` (`fd673b32`) правит оба changelog в том же коммите (подтверждено диффом) |

**Не проверялось и почему:**
- `python -m pytest tests_backend -q` — не запускался: diff не трогает
  `custom_components/houseplan/**/*.py`, только статический JSON перевода.
- `npm run invariants` (модельные инварианты, #254) — не запускался: diff не
  касается геометрии (нет правок рёбер комнат, `layout`, `marker.space`,
  `open_spans`, толщины стен) — ни один из грепов по этим токенам не дал
  совпадений в diff.
- `npm run golden:verify` — не запускался: видимый рендер плана (геометрия,
  стили, слои) не меняется; единственное видимое изменение — новый набор
  строк словаря за новым языковым тегом, который golden не покрывает.
- Полный `node scripts/mutation-gate.mjs` (без `--check`) — не запускался:
  документация самого скрипта прямо называет полный прогон дорогим
  (пересборка бандла в отдельном worktree) и относит его место к
  пред-релизному гейту (`.github/workflows/mutation-gate.yml`), не к
  ревью каждой беты; проверено дешёвой частью (`--check`, применимость патча)
  плюс отчёт автора «поймано 1/1» с описанием, как чинился инфраструктурный
  ложный провал мутанта (`a29d9bc6`→`3c19ba18` — тришейкинг `fr.ts` валил
  сборку раньше, чем гард успевал сработать; переработка обоснованная).
- Полный набор `demo/smoke_*.mjs` — не запускался: `smoke-select.mjs`
  подтверждает, что диапазон изменений локален (3 символа проекта, 2 файла
  `src/**`), широкий прогон не оправдан задачей уровня `small`. Выбраны:
  прямое совпадение (`smoke_french_locale.mjs`, назван в AC3),
  зарегистрированная связь (`smoke_entry_stale.mjs` — фолбэк-плашка теперь
  четырёхветочная), плюс `smoke_german_locale.mjs` вручную — код `de`/`fr`
  делит одну и ту же функцию сборки роли/локейл-рутов и ретрай-плагин,
  регрессия по соседству была бы правдоподобна.
- «НЕОПРЕДЕЛЁННОСТЬ» инструмента (`loadFrench`, `FRENCH_RETRY_ASSET`,
  `LazyLanguageModule`) — решение ревьюера: эти символы — прямые аналоги
  `loadGerman`/`GERMAN_RETRY_ASSET`, которые тоже нигде не зарегистрированы в
  `scripts/smoke-links.mjs` (там только общеконтрактные `LanguageRuntime`,
  `dictionaryFor`, `ensureLanguage` — уже расширены на `smoke_french_locale.mjs`
  автором). `smoke_french_locale.mjs` прямым исполнением проверяет именно то,
  что реализуют эти три символа (один ленивый fr-чанк на профиль fr-CA,
  отсутствие в initial-графе) — прогнан выше и зелёный. Дополнительной записи
  в `smoke-links.mjs` не требуется по той же причине, по которой её нет для
  German-аналогов: связь уже находится прямым совпадением имени смока с темой.
- Лингвистическое качество перевода — вне ревью кода по решению владельца в
  этом же issue (носитель, @OUARZA, проверит после публикации беты).
- `demo/smoke_opening_measure.mjs` и прочие несвязанные смоки — задача не
  трогает геометрию/измерения, тема не пересекается.

## Находки

Нет. High: 0, Medium: 0.

Отдельно проверены места, где легко было бы найти скрытую деградацию:
- **Порядок ветвей в `entryFallbackPlugin`** (`scripts/bundle-manifest.mjs:216-225`):
  тернарник `ru → de → fr → en` — французская ветка вставлена перед финальным
  английским умолчанием, а не после (что было бы недостижимым кодом). Смок
  `smoke_entry_stale.mjs` подтверждает исполнение этой ветки.
- **Роль чанка (`_role: 'locale'`)** (`scripts/bundle-manifest.mjs:33`):
  дизъюнкция `de.ts || fr.ts` не меняет порядок остальных проверок
  (`onboarding`/`editor`) — де-факто проверено юнитом
  `test/bundle-assets.test.mjs` и совпадением манифеста в бандле.
- **Мутант AC5** пришлось дважды перепроектировать в процессе (см. коммиты
  `a29d9bc6`, `3c19ba18`): первая версия валила сборку раньше, чем успевал
  сработать смок-гард — это не найдено ревью как отдельная находка, потому что
  автор исправил это сам до подачи на ревью, а итоговый мутант
  (`--check` подтверждён) действительно проверяет то, что заявлено в
  `because`: «профиль читает не тот словарь» ловится только браузерным смоком,
  не паритет-юнитами.
- **Единственное число, видимое дважды**: не применимо — задача не добавляет
  новую пользовательскую величину (только текстовые строки нового языка);
  `test/single-source-numbers.test.mjs` не тронут и остаётся зелёным в общем
  прогоне юнитов.

## Что проверено и корректно

- **К1 (файлы).** `src/i18n/fr.json`: 1128/1128 ключей, порядок идентичен
  `en.json`, пустых значений и расхождений плейсхолдеров нет (независимая
  проверка скриптом, не только заявление автора). `src/i18n/fr.ts` —
  побуквенный клон `de.ts` с фингерпринт-хендшейком.
  `custom_components/houseplan/translations/fr.json` — 6/6 ключей, полный
  паритет с `en.json` бэкенда (независимая проверка).
- **К2 (реестр и сборка).** `loadFrench`/`FRENCH_RETRY_ASSET` — точная копия
  German-пути; `localeRoots` обобщён на `(de|fr)-`; `_role` учитывает оба
  файла; retry-плагин требует ровно 1/1/1/1 замену (было 1/1/1) и
  падает иначе — юнит `test/bundle-assets.test.mjs` это фиксирует.
  `entryFallbackPlugin` получил французскую ветку (закрывает M1
  спек-ревью r1) — подтверждено и текстом кода, и зелёным
  `smoke_entry_stale.mjs`.
- **К3 (авто-выбор).** `fr`, `fr-FR`, `fr-CA`, `fr-BE`, `fr-CH` → `fr`
  проверено юнитом `test/i18n.test.mjs` (`resolveLanguageCode`, `langOf`) и
  смоком (`fr-CA` в реальном бандле).
- **К4 (доки).** `USER-GUIDE.md`/`.ru.md` называют французский в абзаце
  авто-языка с указанием тегов; оба `CHANGELOG` получили запись с
  благодарностью автору вклада, в том же user-visible коммите.
- **AC1** — паритет доказан скриптом (см. таблицу), плюс французский
  глоссарий продуктовых терминов и скан кириллицы/сентинелов
  (`test/i18n.test.mjs:377-421`) — оба зелёные, независимо
  перепроверены значения (`btn.save`→`Enregistrer` и т.д.) и allow-list
  из 22 «легитимных омографов» — множество совпадает бит-в-бит.
- **AC2** — `languageEntry('fr-CA')` → `fr` покрыт в цикле по всем кодам
  реестра (`test/i18n.test.mjs:56` через `languageEntry(entry.code.toUpperCase())`,
  выполняется и для `fr`); реестр — ровно 4 записи (`en/ru/de/fr`), явных
  дубликатов кодов юнит проверяет через `Set` (`i18n: registry codes and
  English fallback are valid`).
- **AC3** — `smoke_french_locale.mjs` прогнан лично: fr-CA-профиль коммитит
  французский, один запрос fr-чанка на страницу, initial-граф без fr;
  сценарий отказа не дублируется — доказан generic-веткой в
  `smoke_entry_stale.mjs` с французским текстом.
- **AC4** — `npm run bundle:budget`: initial 273 826 Б (совпадает с числом
  автора и headroom не тронут), lazy-locale выросла на fr-чанк
  (45 215 Б суммарно de+fr).
- **AC5** — мутант `french-locale-wrong-dictionary` в
  `scripts/mutation-gate.mjs:683-693` применяется к текущему коду
  (`--check`); по заявлению автора и описанию гарда ловится только
  `smoke_french_locale.mjs`, что согласуется с архитектурой (паритет-юниты
  видят только статический импорт, не рантайм-подмену словаря).

Гейты класса A/B зелёные без исключений; регрессии в German-пути (общий код)
не найдено; трейлеры и правило двух changelog'ов соблюдены.

## Вердикт

Все AC (К1–К4, AC1–AC5) доказаны — либо автотестом, для которого проверена
способность падать (мутант AC5, юниты паритета/глоссария), либо независимой
перепроверкой скриптом поверх заявлений автора (парность словарей, манифест,
allow-list). Находок нет. Задача не расширяет и не сужает продуктовый скоуп
за пределы контракта реестра #62, соответствует `docs/SCOPE.md` (J1/J4) и не
деградирует German-путь.
