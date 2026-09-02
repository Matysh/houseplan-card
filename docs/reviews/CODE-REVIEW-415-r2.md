# CODE-REVIEW-415-r2

Issue: #415 — «Полиш диалога помощи: размер кнопки и белый фон сообщения»
Ветка: `issue/415-support-visual-polish`
SHA ревью: `b0122803737d47950f8c2295b479afa53b8369e0`
Трек: `trivial` (AC в теле issue, без файла в `docs/specs/`) — этап ревью: **code**.
Заход: r2 · блокирующих циклов израсходовано 1 из 2 (зелёный вердикт этого
захода цикл не образует, #227).

## Почему разбор снова полный, а не только по дельте

Между r1 и r2 ветка была **перебазирована на ушедший вперёд `dev`**: r1 стоял на
`afe5e989` (тогдашний `origin/dev`), сейчас `origin/dev` = `206732e9` («ci:
refuse a review round that cites an unreachable SHA», issue #413, чужая
задача — попала в базу только ребейзом). Старый SHA r1
(`2fc8c1203782026bb45647ad54ef11857f7eb2c3`) в дереве больше не существует
(`git cat-file -t` — «could not get object info»): команда `git diff <тот
SHA>..HEAD` из §2.10 не выполнима буквально. Это ровно случай §7.2 «ребейз на
ушедший вперёд `dev` — после ребейза это другой код», поэтому материал этого
раунда — `git diff origin/dev...HEAD` целиком, а не узкая дельта поверх
осиротевшего SHA.

Продуктовый диф при этом **побайтово не менялся** — сверено построчно с телом
CODE-REVIEW-415-r1 (см. ниже раздел «Закрытие раунда r1»): те же три строки в
`src/houseplan-card.ts`, `src/styles/plan.styles.ts`,
`src/styles/dialogs.styles.ts`. Новый код в диапазоне — только пересъёмка
скриншотов и сам документ r1.

## Скоуп

Issue фиксирует два визуальных расхождения после #43:

- **AC1 (smoke):** кнопки «Общие настройки» и «Помощь и обратная связь» в одной
  шапке должны иметь одинаковые фактические ширину и высоту; отдельный размер
  для кнопки помощи не задаётся.
- **AC2 (smoke + golden перед бетой):** поле «Сообщение» должно использовать ту
  же поверхность ввода, что поле контакта (белую в светлой теме, штатную
  тёмную — в тёмной); read-only preview (`.supportraw`) не меняется.

Диапазон `origin/dev...HEAD` (3 коммита):
`d1691f4b` fix: align support controls (класс A+B+C, `Issue: #415`,
`User-Visible: yes`) → `c6fac8bf` docs: review document for #415 (класс C,
`User-Visible: no`) → `b0122803` docs: refresh reviewed support screenshots
(класс C — `docs/images/**`, не класс D; `User-Visible: no`).

Затронуто по коду: `src/houseplan-card.ts`, `src/styles/plan.styles.ts`,
`src/styles/dialogs.styles.ts`, `demo/smoke_support_feedback.mjs`,
`test/support-feedback.test.mjs`, оба changelog, бандлы (класс D),
`docs/images/*.png` + `docs/images/screenshots.json` (класс C, пересъёмка).
Без i18n, без миграции, без geometry — совпадает с заявленным в issue
«Затрагиваемое».

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, без вывода |
| Юнит-тесты | `npm test` | 1729 passed / 0 failed / 1 skipped (совпадает с хендоффом автора) |
| Сборка | `npm run build` | зелёный |
| Сверка бандла (3 копии) | `npm run bundle:sync` → `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js`, `cmp dist/houseplan-assets.json custom_components/.../houseplan-assets.json`, `git status --porcelain` | все три идентичны, рабочее дерево чисто |
| Документационный гейт | `node scripts/check-docs.mjs` | **зелёный** («Documentation checks passed (7 files, 10 external links)») — была High-находка r1, закрыта |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 7 добавленных строк в 3 файлах, новых `any` нет |
| Оффлайн-гейт процесса | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 1» — WARN п.3 (нет `docs/specs/415-*.md`) ожидаемо для трека `trivial` |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. раздел ниже — идентичен выбору r1 (продуктовый диф не менялся) |
| Целевой смок (AC1+AC2) | `node demo/smoke_support_feedback.mjs` | **OK**, `headerActionsMatch: true`, `messageSurfaceMatchesContact: true` |
| Смок умеет падать | тот же смок на `src/houseplan-card.ts` + оба `*.styles.ts` из `afe5e989` (временный `git checkout`, независимо от r1) | `headerActionsMatch: false`, `messageSurfaceMatchesContact: false` — воспроизведено лично, дерево возвращено (`git status --porcelain` пуст, `cmp` бандла зелёный) |
| Точечные смежные смоки | `node demo/smoke_general_settings.mjs`, `node demo/smoke_help_affordance.mjs` | оба **OK** |
| CI-прогон пересъёмки | `gh run view 33592550716` | `conclusion: success`, workflow «Скриншоты документации», `headSha: c6fac8bf` — ссылка в коммите `b0122803` подтверждена, не выдумана |
| Провенанс пересъёмки | `git diff origin/dev...HEAD -- docs/images/screenshots.json` | 10 сценариев, у всех 10 обновился `sourceSha256` (глобальный отпечаток), у 8 обновился `imageSha256` — ровно совпадает с текстом коммита «Eight changed frames were reviewed; two byte-identical frames remain as environment witnesses» |

### Выбор браузерных смоков (`scripts/smoke-select.mjs`)

Вывод идентичен r1 (продуктовый диф не менялся):

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 2
Матрица: 213 смоков · порог «широкого» символа: больше 42 смоков

Прямое совпадение (9): smoke_backup_transfer, smoke_bg_color,
smoke_color_picker_consumers, smoke_dialog_zombie, smoke_esc_dialogs,
smoke_general_settings, smoke_ha_controls, smoke_help_affordance, smoke_sun
  ← _openSettingsDialog (совпадение по имени JS-символа на изменённой строке,
     сама функция не менялась — менялся только список CSS-классов)
```

Решение по 9 найденным — то же, что в r1, и оно не устарело: причина
совпадения (общая строка вызова `_openSettingsDialog`/`_openSupportDialog`, не
сама функция) не изменилась, диф не изменился. Прогнал повторно два самых
предметно близких — `smoke_general_settings.mjs`, `smoke_help_affordance.mjs` —
оба **OK**. Остальные 7 не прогонял по той же причине, что и в r1: чисто
визуальная правка класса, не затрагивающая обработчик клика или разметку
диалогов. Полный прогон всех 213 смоков — предрелизный гейт (§8), не гейт
ревью.

### Что не проверял и почему

- **`npm run golden:verify`** — не прогонял. В `demo/golden/` нет сценариев,
  ссылающихся на `.support-button`, `.header-action` или `.supportmessage`
  (проверено `grep -rl` по `demo/golden/`) — совпадает с тем, что AC2 сам
  относит golden-проверку к «перед бетой», не к код-ревью.
- **`node scripts/model-invariants.mjs`** — не прогонял. Диф не касается
  геометрии, рёбер, `layout`, `marker.space`, `open_spans`.
- **`python -m pytest tests_backend`** — не прогонял. `custom_components/**/*.py`
  не тронут.
- **Performance-профили** — не названы в AC, не прогонял.
- Остальные 7 из 9 «прямое совпадение» смоков — решение см. выше, не изменилось
  с r1.
- Полный прогон 213 смоков — предрелизный гейт, здесь не нужен: диф не «задевает
  всё».

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High** — `node scripts/check-docs.mjs` красный («screenshot source fingerprint is stale»): диф трогает `src/**`, отпечаток документации считается по всему `src/**` безусловно (§8) | Джоба `Docs screenshots` (`workflow_dispatch`) прогнана, артефакт принят `npm run docs:accept -- --reviewed --from=<артефакт>` с явным `--expect-change` на 8 сценариях, эталоны закоммичены в `b0122803` | `node scripts/check-docs.mjs` → «Documentation checks passed (7 files, 10 external links)» — перепроверено лично на SHA `b0122803`, не только со слов автора; CI-прогон `33592550716` подтверждён `gh run view` как реально существующий `success` |

Других находок в r1 не было — таблица из одной строки полна.

## Унаследовано из r1

Ниже — то, что подтверждено уже в r1 (`docs/reviews/CODE-REVIEW-415-r1.md`, SHA
`2fc8c1203782026bb45647ad54ef11857f7eb2c3`) и **дополнительно перепроверено
лично в этом раунде** тем же способом (документ ревью недостижим по SHA, но
процитированные в нём строки кода сверены построчно с текущим диффом — они не
изменились):

- **AC1.** `.support-button` не несёт стилей размера — правило переименовано в
  `.header-action` (`src/styles/plan.styles.ts:188`) и навешено на обе кнопки
  шапки (`src/houseplan-card.ts:11496,11499`); `support-button` остался только
  как селектор-хук, ноль правил стиля на нём (перепроверено `grep -rn
  "support-button" src/` — одно вхождение, в шаблоне). Автотест
  `headerActionsMatch` умеет падать — перепроверено лично на исходниках
  `afe5e989`, независимо от r1.
- **AC2.** `.supportmessage` получил `background: var(--hp-bg)`
  (`src/styles/dialogs.styles.ts`), тот же токен, что `.namein`
  (`src/styles/dialogs.styles.ts:355`, тоже `var(--hp-bg)`) — перепроверено
  `grep -n ".namein" -A5`. `.supportraw` не тронут — не входит в диф. Автотест
  `messageSurfaceMatchesContact` умеет падать — перепроверено тем же способом.
- **Трейлеры и changelog коммита `d1691f4b`** — `Issue: #415`,
  `User-Visible: yes`, оба changelog правлены в том же коммите, терминология
  совпадает с `docs/USER-GUIDE.ru.md:58,1920` («Общие настройки», «Помощь и
  обратная связь») — перепроверено повторным `grep` по гайду.
- **Тестовый контракт `test/support-feedback.test.mjs`** — статический
  дубль-контроль поверх браузерного смока (ровно два вхождения
  `header-action` в шапке, правило `.header-action` содержит `min-width:44px`,
  `.supportmessage` содержит `background: var(--hp-bg)`) — диф файла
  перечитан целиком в этом раунде, не только унаследован.

Не перепроверялось заново, унаследовано без замечаний (диф этих утверждений не
касается): продуктовое рассуждение r1 о том, что задача не расширяет скоуп
(«ни новых сценариев, ни миграции, ни i18n, ни touch/perf») — дельта раунда
(рёбейз + пересъёмка скриншотов + документ) этого вывода не задевает.

## Находки

Новых находок нет. Находка r1 (High, check-docs) закрыта и перепроверена лично
(см. выше), новых High/Medium/Low в дельте этого раунда (рёбейз на `206732e9`,
пересъёмка 8 кадров, документ ревью r1) не обнаружено — рёбейз принёс только
чужой, не пересекающийся с этим диффом коммит #413 (CI-инструмент, не
продуктовый код), конфликтов слияния нет (`git status --porcelain` пуст на
каждом шаге проверки).

## Что проверено и корректно

- **AC1 и AC2** — доказаны автотестом, который умеет падать; перепроверено
  лично в этом раунде независимо от r1 (см. «Унаследовано из r1»).
- **check-docs** — зелёный на точном SHA `b0122803`, ссылка на реальный
  успешный CI-прогон пересъёмки подтверждена через `gh run view`, а не принята
  на слово.
- **Провенанс пересъёмки** — 8 изменившихся кадров и 2 кадра-свидетеля в
  `screenshots.json` совпадают с формулировкой коммита `b0122803` число в
  число.
- **Рёбейз не сломал ничего**: `npm test` (1729/1730), `tsc`, `build`+`cmp`
  трёх копий бандла, `process-gate.mjs`, целевой и точечные смоки — все
  зелёные на актуальном `origin/dev` (`206732e9`), а не на устаревшей базе.
- **Трейлеры класса C.** `b0122803` трогает только `docs/images/**`
  (класс C по таблице §1, не класс D — `dist/**`,
  `custom_components/houseplan/frontend/**`, `demo/golden/baselines/**`), и
  `scripts/validate-commit-provenance.mjs` требует `Release`/`Baseline-Reviewed`
  только для `demo/golden/baselines/*.png|.json` — эта пара трейлеров сюда не
  относится; вместо неё коммит несёт содержательную строку «Canonical Linux
  capture: <ссылка>» в стиле вывода `scripts/docs-accept.mjs`. Формальных
  требований гейта это не нарушает.
- **Никакого расширения скоупа.** Диф раунда — рёбейз, документ ревью,
  пересъёмка скриншотов; продуктовый код не менялся ни строкой.

## Вывод

Единственная находка r1 (High, `check-docs`) закрыта и лично перепроверена, а
не принята со слов автора: гейт зелёный, CI-прогон пересъёмки существует и
успешен, провенанс `screenshots.json` совпадает с текстом коммита. Рёбейз на
ушедший вперёд `dev` потребовал полного разбора (§7.2), а не узкой дельты —
проведён полностью: оба AC передоказаны автотестом, который умеет падать,
независимо от r1. Новых находок нет. Вердикт — зелёный.
