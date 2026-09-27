# CODE-REVIEW-415-r1

Issue: #415 — «Полиш диалога помощи: размер кнопки и белый фон сообщения»
Ветка: `issue/415-support-visual-polish`
SHA ревью: `2fc8c1203782026bb45647ad54ef11857f7eb2c3`
Трек: `trivial` (AC в теле issue, без файла в `docs/specs/`) — этап ревью: **code**.
Заход: r1 (первый цикл, предыдущих раундов и вердиктов нет — разбор полный).

## Скоуп

Issue фиксирует два визуальных расхождения после #43:

- **AC1 (smoke):** кнопки «Общие настройки» и «Помощь и обратная связь» в одной
  шапке должны иметь одинаковые фактические ширину и высоту; отдельный размер
  для кнопки помощи не задаётся.
- **AC2 (smoke + golden перед бетой):** поле «Сообщение» должно использовать ту
  же поверхность ввода, что поле контакта (белую в светлой теме, штатную
  тёмную — в тёмной); read-only preview (`.supportraw`) не меняется.

Затронутые файлы по диффу: `src/houseplan-card.ts`, `src/styles/plan.styles.ts`,
`src/styles/dialogs.styles.ts`, `demo/smoke_support_feedback.mjs`,
`test/support-feedback.test.mjs`, оба changelog, сгенерированные бандлы (класс D).
Без i18n, без миграции, без geometry — совпадает с заявленным в issue «Затрагиваемое».

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, без вывода |
| Юнит-тесты | `npm test` | 1724 passed / 0 failed / 1 skipped (совпадает с хендоффом автора) |
| Сборка + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 7 добавленных строк в 3 файлах, новых `any` нет |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. раздел ниже |
| Целевой смок (AC1+AC2) | `node demo/smoke_support_feedback.mjs` | **OK**, включая новые поля `headerActionsMatch`, `messageSurfaceMatchesContact` |
| Смок-спецпроверка на падение | тот же смок на `src/*` из родительского коммита `afe5e989` | `headerActionsMatch: false`, `messageSurfaceMatchesContact: false` — тест умеет падать |
| Документационный гейт | `node scripts/check-docs.mjs` | **ERROR: screenshot source fingerprint is stale** |
| То же на `origin/dev` (`afe5e989`) | `node scripts/check-docs.mjs` (с исходниками родителя) | зелёный — подтверждает, что именно этот диф делает отпечаток устаревшим |

Рабочее дерево после всех экспериментов с временным `git checkout` родительских
версий файлов возвращено в исходное состояние; `git status --porcelain` пуст,
`git rev-parse HEAD` = `2fc8c120...`, сгенерированные файлы побайтово совпадают
с `HEAD` (`cmp` зелёный).

### Выбор браузерных смоков (`scripts/smoke-select.mjs`)

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 2
Матрица: 213 смоков · порог «широкого» символа: больше 42 смоков

Прямое совпадение (9):
  demo/smoke_backup_transfer.mjs        ← _openSettingsDialog
  demo/smoke_bg_color.mjs               ← _openSettingsDialog
  demo/smoke_color_picker_consumers.mjs ← _openSettingsDialog
  demo/smoke_dialog_zombie.mjs          ← _openSettingsDialog
  demo/smoke_esc_dialogs.mjs            ← _openSettingsDialog
  demo/smoke_general_settings.mjs       ← _openSettingsDialog
  demo/smoke_ha_controls.mjs            ← _openSettingsDialog
  demo/smoke_help_affordance.mjs        ← _openSettingsDialog
  demo/smoke_sun.mjs                    ← _openSettingsDialog
```

Инструмент не назвал `demo/smoke_support_feedback.mjs` (совпадение идёт по
имени JS-символа на изменённой строке, а не по предметной области; сам смок
селектор `.support-button`, а не `_openSupportDialog`, не матчит построчно) —
он взят отдельно, так как прямо назван в AC1/AC2.

Решение по 9 найденным смокам: причина совпадения — обе кнопки шапки лежат на
строке, где стоит вызов `_openSettingsDialog`/`_openSupportDialog`; сама функция
не менялась, менялся только список CSS-классов элемента. Прогнал два самых
предметно близких — `smoke_general_settings.mjs` (диалог настроек целиком) и
`smoke_help_affordance.mjs` (соседняя механика помощи/подсказок) — оба **OK**
без регрессий в открытии диалогов и фокусе. Остальные 7 (`backup_transfer`,
`bg_color`, `color_picker_consumers`, `dialog_zombie`, `esc_dialogs`,
`ha_controls`, `sun`) не прогонял: они используют `_openSettingsDialog` только
как способ добраться до необязанной с этим issue функциональности, а
изменение — чисто визуальное (класс `header-action`, без изменения обработчика
клика или разметки диалогов). Полный прогон всех 213 смоков — предрелизный
гейт, не гейт ревью (§8), и здесь ему делать нечего: диф не «задевает всё».

### Что не проверял и почему

- **`npm run golden:verify`** — не прогонял. AC2 сам относит golden-проверку к
  «перед бетой», а не к код-ревью; в `demo/golden/` нет сценариев, ссылающихся
  на `.support-button`, `.header-action` или `.supportmessage` — совпадает с
  этим разделением.
- **`node scripts/model-invariants.mjs`** — не прогонял. Диф не касается
  геометрии, рёбер, `layout`, `marker.space`, `open_spans`.
- **`python -m pytest tests_backend`** — не прогонял. `custom_components/**/*.py`
  не тронут.
- **Performance-профили** — не названы в AC, не прогонял.
- Остальные 7 из 9 «прямое совпадение» смоков — см. решение выше.

## Находки

### High — check-docs: отпечаток скриншотов документации устарел

`node scripts/check-docs.mjs` падает на этом SHA:
`ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs`.

Этот гейт — часть `validate.yml` (`node scripts/check-docs.mjs --external`),
то есть часть CI Validate, а не только локальная рекомендация. Проверено, что
регрессия внесена именно этим коммитом: на исходниках родителя
(`afe5e989`, = `origin/dev`) тот же скрипт зелёный
(«Documentation checks passed»); после возврата `src/houseplan-card.ts`,
`src/styles/plan.styles.ts`, `src/styles/dialogs.styles.ts` к текущему SHA
скрипт снова красный. Причина устройства гейта задокументирована в PROCESS.md
§8: отпечаток считается по всему `src/**`, поэтому любая правка фронтенда
делает его устаревшим безусловно — «выбирать тут нечего». Ровно этот пропуск
уже дважды стоил продукту красного `docs`-джоба на `dev` (#230, #234, #237);
хендофф автора («Передача на код-ревью») не упоминает пересъёмку скриншотов
вообще.

**Воспроизведение:**
```
$ node scripts/check-docs.mjs
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

**Почему High:** гейт входит в обязательную часть CI (`validate.yml`) и
детерминированно красный на этом SHA; слияние в `dev` в этом состоянии
повторяет уже случавшийся инцидент (`dev` с красным `docs`-джобом до следующей
задачи). Это не вопрос вкуса и не техническое несогласие — факт, проверенный
запуском.

**Что нужно для закрытия:** прогнать джобу `Docs screenshots`
(`workflow_dispatch`), принять артефакт локально
`npm run docs:accept -- --reviewed --from=<распакованный артефакт>` и
закоммитить эталоны вместе с задачей (класс D, трейлер `Baseline-Reviewed`).
Это не в моих полномочиях как ревьюера (я не запускаю релизные workflow и не
пишу в репозиторий) и не то, что можно решить локальной правкой кода — гейт
обслуживается человеком/автором по регламенту §8.

## Что проверено и корректно

- **AC1 (кнопки одного размера).** `.support-button` больше не несёт стилей
  размера — правило переименовано в `.header-action`
  (`src/styles/plan.styles.ts:188`, было `.support-button {min-width:44px...}`)
  и навешено на **обе** кнопки шапки (`src/houseplan-card.ts:11496,11499`);
  класс `support-button` остался только как селектор-хук для JS/смоков, без
  собственных правил стиля (проверено чтением — единственное вхождение строки
  `support-button` в `src/**` осталось в шаблоне, ни одного в `*.styles.ts`).
  Доказано автотестом: `out.headerActionsMatch` в
  `demo/smoke_support_feedback.mjs` сравнивает `getBoundingClientRect()` обеих
  кнопок с допуском 0.01px и **умеет падать** — воспроизведено на исходниках
  родительского коммита (оба новых поля дают `false`).
- **AC2 (единая поверхность поля).** `.supportmessage` получил явный
  `background: var(--hp-bg)` (`src/styles/dialogs.styles.ts:1189-1192`), что
  побайтово тот же токен, что использует поле контакта `.namein`
  (`src/styles/dialogs.styles.ts:353-355`, тоже `var(--hp-bg)`) — источник
  значения один (переменная темы), а не два литерала, вычисляющих одно и то же
  число/цвет. `.supportraw` (read-only preview) не тронут: делит с
  `.supportmessage` только общий базовый блок правил (border/padding/шрифт), а
  собственный фон (`color-mix(...)`) остаётся прежним — соответствует «preview
  не меняется». Доказано автотестом `out.messageSurfaceMatchesContact`
  (сравнение `getComputedStyle(...).backgroundColor`), тоже проверено на
  падение тем же способом.
- **Трейлеры и changelog.** Коммит `2fc8c120` несёт `Issue: #415` и
  `User-Visible: yes`; оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) правлены в том же коммите, формулировки совпадают с
  терминологией `docs/USER-GUIDE.ru.md` («Общие настройки», «Помощь и
  обратная связь» — см. `docs/USER-GUIDE.ru.md:58,1920`).
- **Тестовый контракт остался честным.** `test/support-feedback.test.mjs`
  проверяет ровно две вещи по коду (не только по смоку): что в шапке ровно два
  вхождения `header-action` и что `.header-action`/`.supportmessage` содержат
  нужные правила — статический дубль-контроль поверх браузерного смока.
- **Никакого расширения скоупа.** Диф ограничен двумя классами CSS и одной
  строкой фона; ни новых сценариев, ни миграции, ни i18n, ни touch/perf.
- **Одно число — один источник (44px, фон).** Оба случая сведены к общему
  правилу (`.header-action`, `var(--hp-bg)`), а не к двум местам, вычисляющим
  одно значение по отдельности — ровно то, о чём предупреждает §8.

## Вывод

Единственная находка — High, блокирующая: `check-docs` детерминированно красный
на этом SHA и является частью CI Validate. AC1 и AC2 при этом выполнены и
доказаны автотестом, который умеет падать. Возврат автору для прогона джобы
скриншотов и коммита эталонов; повторный цикл — по дельте (§2.10), с разделами
«Закрытие раунда r1» и «Унаследовано из r1».
