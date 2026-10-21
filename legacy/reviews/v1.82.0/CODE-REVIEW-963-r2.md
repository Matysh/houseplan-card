# CODE-REVIEW-963-r2

Issue: #963 · Трек: ask · Этап: code · Заход: r2 · Материал: `86992ced108bad3e85fd543f9c5d3f4826216084` (рабочая копия на нём, `git rev-parse HEAD` сверен)

## Скоуп

Это повторный раунд, разбор по дельте (PROCESS.md §2.10). Единственная находка r1 — Medium M1 («У двух кнопок панели устройств редакторскую подсказку удалили целиком, а ТЗ §4 требует убирать только дубликаты видимой подписи»). Дельта r2 — ровно `git diff 4e47a920f4e91a2e7fa94f73b9d39448ec1ae7a1..86992ced108bad3e85fd543f9c5d3f4826216084`: 13 путей, два авторских коммита (`fc2c89702` User-Visible: yes, `86992ced1` User-Visible: no) плюс не редактировавшийся автором коммит `074a5704f` (публикация `docs/reviews/CODE-REVIEW-963-r1.md` конвейером — не предмет оценки).

Классы изменений дельты: A — `src/houseplan-editor-runtime.ts` (2 строки, атрибут подсказки), `src/i18n/{ru,en,de,fr}.json` (восстановление одного ключа в каждом); B — `demo/smoke_ui_polish_963.mjs` (новая hover-матрица + самокоррекция data-oracle); C — `docs/ARCHITECTURE.md`, `docs/CHANGELOG*.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `scripts/monolith-baseline.json`. Принятый текст ТЗ не менялся (body SHA-256 `6dda5c08f0266928d073aa3c45e57d2375816d4553ef65afcffbc94e5ac2ad2c`, сверен с REVIEW_CONTEXT), `track:ask` сохраняется.

## Риск по изменённым участкам (#707) — покрытие AC ТЗ

Классы из хендоффа (geometry/touch/perf/ux) относятся к материалу r1 в целом и дельтой r2 не затрагиваются — ни `wall-node-editor.ts`, ни `chrome-tooltip*.ts`, ни `section-motion.ts` в диапазоне `4e47a920f..86992ced1` не изменены (подтверждено `git diff --stat` выше — этих путей в списке нет). Единственный релевантный класс этого раунда — **ux**: восстановленные ключи `title.icon_rules` (все 4 локали) и повторно используемый `device_inbox.title`, прямо покрыты ТЗ §4 («Содержательные пояснения и подсказки кнопок без текста оставить. Не удалять accessible name вместе с дублирующим tooltip») — это и есть та норма, нарушение которой было найдено в r1. `route: reclassify` не требуется, трек уже `ask`.

## Как проверялось

Прогон Validate на точном материале `86992ced1` зелёный — проверил сам через `gh run view 39301833617 --json headSha,status,conclusion,event`: `headSha` совпадает с материалом ревью, `conclusion: success`, `attempt: 1`, `event: push`, `displayTitle` совпадает с сообщением коммита `86992ced1`. Список джобов в этом прогоне: Фронтенд (типы/юниты/мутанты/бандл) — success; Бэкенд pytest — success; все 3 шарда браузерных смоков — success; Golden — success; Перф-смок — success; «Смоки: все шарды зелёные» — success. Это и есть основание не перегонять `tsc`/`npm test`/`npm run build`/`golden:verify`/полный browser-набор по правилу #343 — они уже зелёные на этом точном SHA, а не на устаревшем/перебазированном предшественнике (в отличие от r1, где я принимал это по описанию хендоффа, здесь проверил сам через API, т.к. автор прямо подчёркивает «предыдущий зелёный r1 CI не выдаётся за новое исполнение», и это нужно было перепроверить для именно финального SHA).

Бюджет раунда потрачен на построчное чтение дельты: `src/houseplan-editor-runtime.ts`, 4×`i18n/*.json`, `demo/smoke_ui_polish_963.mjs` (обе правки — `fc2c89702` и `86992ced1` — раздельно через `git show`), `scripts/monolith-baseline.json`, доки.

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | Не перегонялся (принят по Validate на точном SHA, проверено мной через GitHub API) | run 39301833617, джоб «Фронтенд: типы, юниты, мутанты, синхрон бандла» |
| `npm run golden:verify` | Не перегонялся (принят; дельта r2 не трогает рендер/эталоны — `demo/golden/baselines/**` отсутствует в `git diff --stat` дельты) | run 39301833617, джоб «Golden-кадры против принятых эталонов» — success |
| `demo/smoke_ui_polish_963.mjs` (новая hover-матрица 8 строк + `device_hints_preserve_data`) | Не перегонялся отдельно — входит в заявленный browser 397/397 полного CI на этом же SHA (3 шарда, все success) | run 39301833617 |
| `demo/smoke_ui_polish_963_touch.mjs` | Не перегонялся — дельта r2 не трогает touch-путь (`chrome-tooltip-lazy.ts` не в дельте); заявлен PASS/5 в хендоффе, входит в тот же browser-набор | run 39301833617 + хендофф |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | Не перегонялся — заявлен PASS/0 предупреждений; трейлеры обоих коммитов дельты проверены вручную (`git log -1 --format=%B`) | хендофф + собственная проверка |
| `node scripts/mutation-gate.mjs --check` | Не перегонялся — `scripts/mutation-registry.mjs` отсутствует в дельте r2 (не менялся), 6 зарегистрированных witness из r1 не затронуты этим фиксом | `git diff --stat` дельты |
| pytest / HA-harness | Не прогонялся — Python/backend не затронуты дельтой; джоб «Бэкенд: pytest» — success в том же прогоне | run 39301833617 |

**Чего не проверял:** реальный повтор hover-матрицы (8 строк) в браузере локально — принято по зелёному browser-набору на точном SHA (трижды сверенному: сам SHA, шарды, джобы). Байтовую точность +488 B не пересчитывал вручную символ-в-символ — математика `3229084+488=3229572` сходится, `scripts/monolith-baseline.json` обновлён на то же число, разрешение владельца на небольшие превышения (comment 6265567946) сформулировано общо («если незначительное превышение... разрешаю поднять лимиты»), не привязано к конкретной задаче/числу, и уже применялось в r1 к первым 114 B — применение к ещё 488 B того же характера (восстановление собственного же текста) последовательно.

## Находки

Нет. Делта r2 — точечное исправление ровно того, что требовал M1, без побочных эффектов.

## Что проверено и корректно

- **Исправление M1 корректно и дословно.** `src/houseplan-editor-runtime.ts:10824-10829`: `data-hp-tooltip=${this.host._t('device_inbox.title')}` и `data-hp-tooltip=${this.host._t('title.icon_rules')}` возвращены на те же два элемента (`[data-tool=device-inbox]`, `[data-tool=icon-rules]`), паттерн 1:1 совпадает с соседними кнопками той же панели (`add-device`, `device-magnets`), которые в r1 были признаны правильно мигрированными. Нет дублирования/второго набора кнопок.
- **Текст восстановлен дословно из исходника, не придуман заново.** Сверил `title.icon_rules` по всем 4 локалям и `device_inbox.title` (переиспользован, не создан заново — ключ существовал непрерывно) с версией на `origin/dev` (`git show origin/dev:src/i18n/en.json`) — EN `"Icon rules: which MDI icon devices get by name"` совпадает посимвольно с тем, что было до удаления в исходной миграции и с тем, что цитировала находка r1. RU/DE/FR в `fc2c89702` также совпадают с текстом, который сам автор использует как ожидание в новом тесте (`demo/smoke_ui_polish_963.mjs:124-127`) — то есть реализация и тест независимо согласованы на одном и том же тексте.
- **Новый тест — не косметика, а содержательная защита регресса.** Hover-матрица в `demo/smoke_ui_polish_963.mjs` (добавлена `fc2c89702`, уточнена `86992ced1`) для каждого из 4 языков: наводит обе кнопки, проверяет `tip.innerText()===hints[index]` (видимый текст совпадает с ожидаемой длинной фразой), `button.innerText()!==hints[index]` (отличие от короткой видимой подписи — т.е. это не дубликат), `aria-describedby` указывает на реальный id бабла, `button.getAttribute('title')===null` (нет второго параллельного native-тултипа). Это именно то, что эксплицитно красило бы регресс M1: до фикса `tip.isVisible()` был бы `false` (подсказки не было вовсе), проверка `aria-describedby`/innerText не прошла бы. Обычный positive-input PASS, фиксирует нужный инвариант без необходимости в отдельном registered witness (это не защитный/guard AC, а восстановление удалённого контента — доказывается ordinary assertion, как и требует общая политика).
- **Честно исправленная собственная ошибка оракула, не сокрытие проблемы.** `fc2c89702` сравнивал `_serverCfg`/`_layout` после 4 переключений языка с единым `baseline`, снятым в начале файла (строка 20) до какого-либо `setConfig` — некорректно, т.к. `setConfig({...,language})` — штатное публичное действие, которое могло менять видимый `_config`, но не обязано не менять `_serverCfg`/`_layout`; сам факт первого `setConfig` уже делает сравнение с «до всех языковых переключений» шатким по конструкции теста, а не по продукту. `86992ced1` поправил это: `hintBaseline` снимается заново после каждого `setConfig(language)+mode('devices')+settle()`, сравнение — только «не изменилось ли между наведением двух кнопок внутри одного языка». Автор прямо описал это в хендоффе как самостоятельно найденный и закрытый ложный RED теста, а не продукта — подтверждается диффом: `src/houseplan-editor-runtime.ts` в `86992ced1` не тронут, меняется только тестовый файл.
- **`baseline` (строка 20) не осиротел** — используется отдельно в `out.visual_actions_preserve_data` (строка 82), поэтому у двух разных проверок две независимые точки отсчёта, как и должно быть.
- **Трейлеры и changelog.** `fc2c89702`: `Issue: #963`, `User-Visible: yes` — и в этом же коммите правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` (проверено `git show --stat fc2c89702`), текст на двух языках описывает именно восстановление подсказок, без лишнего. `86992ced1`: `Issue: #963`, `User-Visible: no` — изменён только тестовый файл, changelog не требуется и не тронут. Корректно.
- **Размеры.** `scripts/monolith-baseline.json`: `bundleBytes` `3229084→3229572` (+488, совпадает с заявленным в хендоффе и с суммой `3229084+488`). `docs/DEVELOPMENT.md` синхронно документирует прибавку и её причину (восстановленный текст в 4 локалях). Initial View ceiling (`327770+2000`) и hard wall (`352000`) не менялись — восстановление текста добавляет только raw-байты, не gzip initial View сверх уже принятой в r1/r2-хендоффе полосы (327899 B заявлено, внутри `327770+2000`). Разрешение владельца (issue comment 6265567946) сформулировано как общее правило для малых затратных-для-устранения превышений, применено последовательно с r1.
- **release-ledger не менялся** (`docs/release-ledger/v1.81.0/963.json` отсутствует в дельте) — корректно: классификация `line-fix`/`introducedBy: 931` не зависит от того, что именно внутри этого же issue было доведено на втором заходе.
- **Документация.** `docs/ARCHITECTURE.md`, `docs/STATUS.md` получили по одной точной фразе про сохранённые content-подсказки каталога устройств/правил иконок — не противоречат остальному тексту, не дублируют.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium M1: исчезли содержательные подсказки `[data-tool=device-inbox]` и `[data-tool=icon-rules]`, нарушение ТЗ §4 (убирать только дубликаты подписи) | Обе кнопки получили обратно `data-hp-tooltip` с дословно восстановленным текстом (переиспользован `device_inbox.title`, восстановлен `title.icon_rules` в 4 локалях); добавлена hover-матрица 4 языка × 2 кнопки, проверяющая видимый текст бабла, отсутствие дубликата с подписью, `aria-describedby` и отсутствие native `title` | `src/houseplan-editor-runtime.ts:10824-10829`; `src/i18n/{ru,en,de,fr}.json` (`title.icon_rules`); `demo/smoke_ui_polish_963.mjs:124-152`; оба changelog в коммите `fc2c89702` |

## Унаследовано из r1

Принято без повторной проверки в этом раунде (материал не менялся дельтой r2, проверено построчным diff `git diff 4e47a920f..86992ced1 --stat` — ни один из перечисленных ниже путей в список не входит):

- **AC1–AC9 (кроме части AC4/AC9, затронутой M1)** — панель свойств, меню «Комнаты»/«Фигуры», единые подсказки, общая шапка, диалог «Устройства», выделение объектов, вращатель колонны, прозрачность лестниц, побочные эффекты. Документ: `docs/reviews/CODE-REVIEW-963-r1.md`, материал `4e47a920f4e91a2e7fa94f73b9d39448ec1ae7a1`.
- **Защитная таблица «AC · чем доказан · чем краснеет»** — 6 зарегистрированных witness (`editor-tooltip-arms-after-touch-focus-963`, `properties-reserves-empty-height-963`, `editor-tooltip-opens-without-delay-963`, `editor-tooltip-survives-context-963`, `background-stairs-stay-opaque-963`, `column-rotation-target-shrunk-963`) в `scripts/mutation-registry.mjs` — файл не изменялся дельтой r2, повторная сверка не требуется.
- **Размерная база до фикса M1** (initial View `327770+2000`, raw baseline `3229084` на момент r1) — подтверждена r1, в r2 только инкрементально пересчитана на `+488 B` (см. «Что проверено» выше).
- **Риск по классам geometry/touch/perf** (`wall-node-editor.ts`, `chrome-tooltip-lazy.ts`, `chrome-tooltip.ts`, `section-motion.ts`) — не затронуты дельтой r2, повторная сверка не требуется.

## Маршрут и вердикт

Новых находок нет; `reclassify` при зелёном вердикте противоречив (PROCESS.md §10, «Маршрут вердикта», #726) — поле `route` несёт обязательное по схеме значение `fix` как нейтральный дефолт для зелёного исхода, не как указание на возврат автору.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/963-ui-polish`, коммит `86992ced108b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c1a6e7a68201a84bb77d4603d8d31083a889affe`
  ```
  git log --all --format='%H %T' | grep c1a6e7a68201
  ```
- Тело issue: `6dda5c08f0266928d073aa3c45e57d2375816d4553ef65afcffbc94e5ac2ad2c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjg0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3NCwib3V0cHV0X3Rva2VucyI6MjkzNDgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTQwNzEzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mzk2MzQyMSwiY29zdFVzZEVzdGltYXRlIjoxLjY0OTE2NDE5OTk5OTk5OTd9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjo0OTUxOTksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjY1NDQ0ODE5OTk5OTk5OTYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5273 output_tokens=29365 cache_creation_input_tokens=140713 cache_read_input_tokens=3963421 num_turns=50 -->
