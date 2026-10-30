# CODE-REVIEW-1155-r1

Issue: #1155 · Трек: show · Этап: code · Заход: r1 · Блокирующих циклов: 0/2
Материал: `e15815ce29563b80ee5e382153d1bdf006a9c73d` (ветка `issue/1155-ha-dialog-diagnostic`, база `1fa2b03467fe521d3a071c5bd7e617ebde6a542a`)

## Скоуп

Задача инфраструктурная (`PROCESS.md` §1): актуализировать самостоятельную
offline-диагностику `demo/verify_ha_dialog_discard_recovery.mjs` под уже
принятый в #976 контракт Keep/Discard (родительский HA-dialog остаётся
модальным до решения владельца; старое ожидание `ha.open === false` было
устаревшим). Диффу затронуты только: `demo/verify_ha_dialog_discard_recovery.mjs`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.82.0/1155.json` (новый), `scripts/ci-registry-inventory.json`.
Продуктовый исходный код (`src/**`) не затронут — подтверждено
`read:diff` (единственный исполняемый diff целиком прочитан).

Core user job из `docs/SCOPE.md`: прямо не обслуживает — это тестовая
инфраструктура, обслуживающая достоверность диагностики для существующих
диалоговых сценариев (marker/room/space/settings/создание устройства).

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT`, тело issue #1155 и оба комментария
владельца (взятие в работу + хендофф), `docs/process/REVIEWER.md`,
`AGENTS.md` (разделы Tracks/Specs/Commits), `demo/verify_ha_dialog_discard_recovery.mjs`
целиком (финальная версия), полный `read:diff` (единственный патч-диапазон),
`docs/DEVELOPMENT.md` (контекст вокруг изменённого абзаца #851/#1155),
исходники `src/hp-confirm.ts` и `src/hp-dialog.ts` — чтобы независимо
убедиться, что новые селекторы диагностики (`confirm.querySelector('hp-dialog')`,
`role="alertdialog"`, `:modal`, `showModal()`/`_ensureNativeModal`) реально
соответствуют продуктовой реализации, а не считыванию авторских выводов на
веру. `HpConfirm.createRenderRoot()` возвращает `this` (без своего shadow DOM),
поэтому `confirm.querySelector('hp-dialog')` корректно достаёт light-DOM
потомка; `hp-dialog` рендерит `role=${this.alert ? 'alertdialog' : 'dialog'}`
и для `alert`-варианта идёт по native-диалоговой ветке `_ensureNativeModal()`
→ `showModal()`, то есть селектор `dialog[role="alertdialog"]` действительно
попадает на модальный native `<dialog>`.

Исполненные проверки этого ревью (через `mcp__houseplan_review__run_check`,
material `e15815ce2…`):

| Check | Результат |
|---|---|
| `read:diff` | PASS — полный патч (единственный источник дельты) |
| `read:log` | PASS — один коммит `e15815ce2 test: align authentic HA discard recovery with retained parent` |
| `unit:test/release-ledger.test.mjs` | PASS 6/6 — новая запись `1155.json` не создаёт ложного User-Visible/milestone-членства |
| `static:ci-registry-inventory` | PASS — новая запись реестра согласована |
| `unit:test/ci-registry-inputs.test.mjs` | PASS — целостность входов реестра не нарушена |
| `read:base:demo/verify_ha_dialog_discard_recovery.mjs` | PASS (прочитан для сверки, дельта уже дана `read:diff`) |
| `static:smoke-select` | **недоступен** в этой сессии — завершился usage-ошибкой (`--base <ref>` не передан; check_id не принимает параметров). Не повторял с обходным запросом |

Переиспользовано, не повторялось (validate-gate зелёный для этого SHA,
https://github.com/Matysh/houseplan-card/actions/runs/41071673852,
«review-light proof is complete»): RED/PASS прогон диагностики на
подлинной закреплённой HA-фикстуре (28 именованных результатов),
`node --check`, `npm run gate:small -- --smokes` (244s/0 failures),
`npm run gate:small -- --base=1fa2b03467f…` (264s/0 failures),
`node scripts/ci-registry-inventory.mjs` и
`node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report`
(единственный ожидаемый WARN — инфраструктурный вход без S1–S6).

Не проверял: трейлеры `Issue:`/`User-Visible:` коммита текстом — в наборе
доступных check_id нет инструмента для чтения полного тела коммита
(`read:log` отдаёт только oneline), а общий Bash/git недоступен. Это
механический гейт, который должен был отсечь пуш локальным pre-commit hook
(`AGENTS.md`, «Commits and branches»); независимо текст трейлера в этой
сессии не подтверждён. Поскольку коммит не docs-only (`demo/*.mjs`
затронут), трейлеры обязаны присутствовать; явного противоречия не найдено,
но подтверждения тоже нет — называю это честно как границу, не как находку.
Полный HA E2E/живой сервер — не требуется по собственному риск-разделу
автора и характеру задачи (offline-фикстура тестовой инфраструктуры).

## Независимый разбор кода

Главное изменение — `waitConfirm`: вместо `ha?.open === false` (подтверждение
= родитель закрылся) теперь требуется одновременно:
`ha?.open === true` (родитель остаётся modal), `ownerSurface:modal`,
дочерний `hp-confirm` → `hp-dialog` → `dialog[role="alertdialog"]` с
`surface.open === true`, `:modal`, ненулевой `getBoundingClientRect`,
`visibility: visible` и фокус внутри (`confirm.contains(activeElement)`).
Это именно наблюдаемое поведение из #976, а не повторение прежнего дефекта
«DOM-узел есть — значит подтверждение открыто»: по коду `hp-dialog.ts`
оба диалога (`ha-dialog`/`wa-dialog` владельца и native `<dialog>` диагностики)
действительно могут быть одновременно `:modal` — top layer браузера это
допускает, оба используют `showModal()`.

`clickAuthenticClose` и `decide` переведены с синтетического `page.evaluate(() =>
button.click())` на настоящие Playwright-локаторы с `.click()` (actionability
checks, trusted-событие) — это закрывает конкретное требование AC2 «действия
Playwright без принудительного клика», а не косметика. `edit` аналогично
переведён на `locator.fill()` вместо ручной установки `.value` +
синтетического `Event('input')`; итоговое склеенное значение
(`${currentValue}${suffix}`) эквивалентно прежней логике — не нашёл
расхождения в итоговых строках между кодами «до» и «после».

Новый явный `assert.equal(... inputValue(), firstDraft, 'Keep must retain the
first draft...')` — ровно то, что требует AC2 («Вернуться» сохраняет
исходный черновик), раньше это неявно проверялось только через последующее
равенство `secondDraft`; теперь есть отдельная точка отказа на первом черновике.

Запись `saved` конфигурации до всех сценариев и финальное
`assert.equal(JSON.stringify(_serverCfg), saved, ...)` закрывает «сохранённая
конфигурация … не меняется» из AC2/AC3 для всех форм и создания устройства
одним сквозным снимком — не локальный патч по одному кейсу.

Проверил риск гонки/таймаута: `waitConfirm` при неудаче ловит исключение и
формирует диагностический `state` (owner/dialog/haOpen/closeCount/confirm/
confirmModal/confirmFocus/buttons) перед повторным throw — это именно то
расширенное сообщение, которое в хендоффе предъявлено как «RED до
исправления»; по формату вывода он совпадает с текстом из тела issue
(`owner:true, dialog:true, haOpen:true, closeCount:1, confirm:true`),
что независимо подтверждает связь старого отказа с новым кодом диагностики
(не выдуманный лог).

Не нашёл: оставленного параллельного старого пути (`waitConfirm` — ровно
одна реализация, старая ветка `ha?.open === false` удалена целиком, не
закомментирована); нового публичного контракта; влияния на persisted
config/compatibility; изменения продуктового поведения; уязвимостей
(тестовый offline-скрипт без внешних данных).

## Применимость критериев трека show (route)

- complexity — низкая: переписана логика ожидания внутри одного файла.
- surfaces — одна поверхность: единственный диагностический скрипт.
- migration — нет: никаких конфигов/compatibility-полей.
- ux-contract — нет нового UX-контракта: наблюдаемое поведение (retained
  parent modal) уже зафиксировано и принято в #976, продуктовый код не
  менялся.
- perf-touch — не затронуто.
- undocumented — поведение, которое диагностика теперь проверяет, уже
  описано в принятом #976 и в обновлённом `docs/DEVELOPMENT.md`/`docs/STATUS.md`
  в этом же диффе.

Все критерии §5 пройдены → `route: fix`.

## Находки

Находок High/Medium нет.

## Что проверено и корректно

- AC1 — доказано: независимо прослежена цепочка селекторов `hp-confirm` →
  `hp-dialog` → `dialog[role="alertdialog"]` против исходников компонентов
  (`src/hp-confirm.ts`, `src/hp-dialog.ts`); совпадает с условием диагностики
  и с авторским PASS/28 результатов (CI validate-gate, переиспользовано).
- AC2 — доказано: явный assert первого черновика, одно/два `hp-close`,
  Discard и чистое закрытие, Playwright-клики без синтетики, итоговое
  равенство `_serverCfg` — прочитаны по коду и согласуются с PASS
  диагностики на подлинной фикстуре (переиспользовано).
- AC3 — `fixture.assertClean()` без изменений вызывается в конце; diff
  ограничен диагностикой и документацией, продуктовый код не тронут
  (подтверждено `read:diff` целиком); реестр/ledger проверены тремя
  исполненными в этом ревью юнит/static-проверками (PASS).
- `docs/release-ledger/v1.82.0/1155.json`: категория `infra`, без
  milestone-членства — подтверждено исполнением `release-ledger.test.mjs`.
- `docs/DEVELOPMENT.md`/`docs/STATUS.md`: текст соответствует фактическому
  изменению кода, не завышает и не занижает сделанное.

## Чего не проверял

- Текст трейлеров `Issue:#1155`/`User-Visible:no` коммита — нет доступного
  check_id для чтения полного тела коммита в этой сессии (только oneline);
  полагаюсь на локальный pre-commit hook и `process-gate` (PASS по хендоффу).
- `static:smoke-select` — оракул недоступен (usage-ошибка, параметры нельзя
  передать); полагаюсь на авторское заключение «дополнительных browser-smokes
  не требуется», правдоподобное для diff, не касающегося `src/**`.
- Исполнение самой диагностики на подлинной ~124 МБ HA-фикстуре — нет
  check_id для прямого запуска в этой сессии; переиспользовано зелёное
  CI-доказательство (validate-gate + авторский RED→PASS лог).
- Живой HA-сервер/аутентификация/GPU — не требуется по характеру задачи и
  риск-разделу автора.

## Маршрут и вердикт

Вердикт: зелёный. High: 0. Medium: 0. Побочных находок нет (policy
`mode: issues` — `outside_findings` пуст).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjNiNjFjOWU3NzkyNTUwYmE4NGVkMGNhMWI0YmJjMjg2MGY4YWFiOWU4NmI5ZjM0ZjhmMTUyNTc4NTMyODJmNTMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI1YTUxYTU1MDBkNmJhYWM4MWNiZTdkY2Q3ZTA3YWI5YTBkNTFiNWExYTllMzRlZmI3MTA2N2E1NTcyYzZhMjE0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTU1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJlMTU4MTVjZTI5NTYzYjgwZWU1ZTM4MjE1M2QxYmRmMDA2YTljNzNkIiwidHJlZSI6ImMzMWMwYmQ0NTg2MjcyNDNjN2UzMTY5NGY3YzU1NDhiYzJhMjc4ZjYiLCJib2R5RGlnZXN0IjoiYzZiNjg1YWRmYWY2ZTBlN2QwZmY4OTgzY2Q5NWUxNzZmNzkzOGRhOGQxNzA5MzRlYTg4ZDQ0N2I1NzY0MzMyYyIsInByb2R1Y2VyUnVuIjoiNDEwNzI5MTI5NzQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjI4ZDQwZjcyYWJlYTU4Yjk0NDgwMzQ1MjhiNzFhZWUzMGE3YzI0YjA3YzE3MzgyNDk0NThhNTZlOWNiNmEyOGYiLCJ2ZXJkaWN0RGlnZXN0IjoiMDczN2QwZDg3ZGZmYzZhMTEwMzU4MGI5MTE0MzI5ZGViODU0YTVkNDE0OWY5OTcyYjdmOTA5NWNmODE2YjBkZSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlNzQ4NDZiNGYwOWY3MGJlZGFmOWMxZjJmMDA0OWUwNWJmMzM4ODk0ZjdjOWFjZjllZGJhZTdjOWFmZGI1YWUwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTI1NTY2NTAxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTU1I2lzc3VlY29tbWVudC02NTI1NTY2NTAxIiwiYm9keURpZ2VzdCI6ImFmOWY3YmIzYmQwYTQwZDdlMTA3N2IwZDRkY2MzZmU4YjNjM2VmN2RkODZjNzljODk2ZGRjZGY5NDY5MmMxMTEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1155-ha-dialog-diagnostic`, коммит `e15815ce2956` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c31c0bd458627243c7e31694f7c5548bc2a278f6`
  ```
  git log --all --format='%H %T' | grep c31c0bd45862
  ```
- Тело issue: `c6b685adfaf6e0e7d0ff8983cd95e176f7938da8d170934ea88d447b5764332c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41072912974,"run_attempt":1,"digest":"5a51376adaf82c8e497443c713b2af78231cf247ded3e64b2b74ccaa7c82c524"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjMwMTEzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExMzcxOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMwMDQ3OTUsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNTcwOTd9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjo0MTgyMzksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjM1NzA5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=66 output_tokens=30113 cache_creation_input_tokens=113719 cache_read_input_tokens=3004795 num_turns=40 -->
