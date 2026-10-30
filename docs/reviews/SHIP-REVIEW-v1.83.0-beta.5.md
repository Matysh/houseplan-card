# SHIP-REVIEW-v1.83.0-beta.5

Итог: High 0 · Medium 0 · Low 2

Кандидат `1f3f73f64df058182da626ea1588990f97279f04`, база `v1.83.0-beta.4`
(`08b154115ff815062cfc0221f39f7e53545dbe45`). Задач в пакете: 1 (#1151),
слита без ревью модели (track:ship). Диапазон содержит 2 коммита задачи:
`094a5cf20f` (fix) и `1f3f73f64d` (chore: пересборка производных файлов).

## #1151 — Вторая протечка несуществующего токена --sp-8 вне .farhint (.device-inbox-empty)

### ТЗ

Заменить `padding:var(--sp-8)` у `.device-inbox-empty` на `--sp-6` (16px), не
трогая остальные строки каталога/поиска/действий; доказать
`node demo/smoke_device_inbox.mjs`: реальный пустой результат фильтра при
desktop/390px имеет вычисленный padding16px, без записи config/layout.

### Как проверял

Независимо, до сопоставления с хендоффом/proof автора:

- Прочитал `src/styles/base.styles.ts:19-24` — объявлены только
  `--sp-1…--sp-6` (`--sp-6: 16px`), `--sp-8` в токенах не существует —
  подтверждает, что `padding: var(--sp-8)` на `.device-inbox-empty` был
  невалиден и по спецификации CSS вычисляется в `0` (shorthand `padding`
  не наследуется, инициаль — `0`), что совпадает с `before.png` (0px) в
  `docs/design/1151-empty-catalog/2026-10-30/README.md`.
- Прочитал текущий `src/styles/editor-dialogs.styles.ts:761` —
  `.device-inbox-empty { color: var(--hp-muted); text-align: center;
  padding: var(--sp-6); }`.
- `mcp__houseplan_review__run_check(read:diff)` → passed. В дифф-файле
  нашёл ровно один содержательный hunk по этому файлу
  (`@@ -758,7 +758,7` в `src/styles/editor-dialogs.styles.ts`): одна
  строка `--sp-8` → `--sp-6`, остальные строки `.device-inbox-*` не
  задеты — ТЗ «не менять остальные строки каталога, поиск и действия»
  выполнено буквально.
- Прогрепал `--sp-8` по всему дереву: единственное оставшееся
  использование — `src/styles/chrome.styles.ts:67` (`.farhint`). Это
  ожидаемо и вне скоупа: заголовок задачи сам говорит «вне `.farhint`», а
  `docs/reviews/SPEC-REVIEW-1145-r2.md:57-60,105-108` фиксирует, что это
  первое (`.farhint`) и второе (`.device-inbox-empty`, = F1 из r1 = это
  issue) использования токена были разведены на этапе спецификации;
  `.farhint` отдельно не заводился как часть #1151. Правка не вышла из
  трека ship по смыслу — геометрия/конфиг/перф не затронуты, класс риска
  `visual` не повышен.
- Прочитал diff `demo/smoke_device_inbox.mjs` (`@@ -67,6 +67,11` и
  `@@ -106,5 +111,16`): новый блок добавляет ровно требуемые проверки —
  desktop: `search.value='__1151_no_matches__'` → `getComputedStyle(empty)
  .padding === '16px'`; затем `page.setViewportSize({width:390,...})`,
  повторный пустой поиск, снова `padding==='16px'` и
  `left>=0 && right<=390`, плюс сравнение `before/after` снэпшота
  `config/layout/cfgRev` для подтверждения отсутствия записи. Это
  протекционный (способный покраснеть) тест: до фикса тот же код дал бы
  `padding !== '16px'` (0px, см. `before.png`), так что регрессия токена
  будет поймана без отдельного мутанта.
- `docs/release-ledger/v1.82.0/1151.json` — `category: stable-fix`,
  обоснование соответствует характеру правки, `visual.smokes` указывает
  на `smoke_device_inbox.mjs`.
- `docs/CHANGELOG.md:5` и `docs/CHANGELOG.ru.md:11` — обе записи добавлены
  под `## Unreleased`, формулировка соответствует ровно заявленному
  (без переобещаний), трейлер `User-Visible: yes` согласован с этим.
- `mcp__houseplan_review__run_check(build:build)` → passed (exit 0) —
  CSS-правка компилируется, бандл собирается; это же объясняет
  сопутствующую правку `scripts/ci-registry-inventory.json` и бинарные
  `custom_components/houseplan/frontend/houseplan-assets/*` (пересборка
  на изменённый контент → новые хеши в именах файлов), что и есть
  содержание коммита `1f3f73f64d` («refresh computed check inventory for
  1151 classification») — механическое следствие сборки, не отдельная
  логика.
- `mcp__houseplan_review__run_check(smoke:demo/smoke_device_inbox.mjs)` —
  **failed** в этой среде ревью (`EXC Failed to fetch dynamically imported
  module: http://demo.local/assets/houseplan-card.js`,
  `page.waitForFunction: Timeout 30000ms exceeded`). Проверил, что это не
  связано с правкой: прогнал `build:test`, затем `build:build` — оба
  passed, повторный прогон смоука дал тот же identical failure (тот же
  stdout/stderr hash). Для контроля прогнал не связанный с задачей
  `smoke:demo/smoke_decor_multiselect.mjs` — тот же `EXC Failed to fetch
  dynamically imported module: http://demo.local/...` и тот же таймаут.
  Это системная проблема рантайма ревью-харнесса (сервер демо-страниц/
  сеть недоступны для headless Chromium в этом окружении), а не дефект
  кода #1151 — см. находку L2 ниже.

### Находки

- **L1 (Low, качество).** Новый блок `demo/smoke_device_inbox.mjs:114-124`
  (viewport 390px) написан в сжатом стиле без пробелов вокруг операторов/
  двоеточий (`page.setViewportSize({width:390,height:820})`,
  `const before=JSON.stringify({config:c._serverCfg,layout:c._layout,
  rev:c._cfgRev})` и т.д.), тогда как весь остальной файл отформатирован
  обычным образом (пробелы, разбивка). Последствие: раздел читается
  заметно хуже соседних ~110 строк и будущий diff по этому месту будет
  сложнее ревьюить на глаз; проект не гоняет lint/prettier автоматически
  (в `package.json` нет скрипта `lint`), так что несоответствие не будет
  поймано CI. Локальное улучшение: переформатировать новый блок с теми же
  отступами/пробелами, что и остальной файл (без изменения логики).
- **L2 (Low, доказуемость/процесс, не дефект кода).** Соразмерный
  исполнимый oracle для AC (`node demo/smoke_device_inbox.mjs`) заявлен
  автором как PASS, но независимо выполнить его в этой ревью-среде не
  удалось: систематический сетевой/сборочный сбой `demo.local` воспроизводится
  и на несвязанном смоуке — то есть это ограничение харнесса ship-review, а
  не результат «тест упал» на коде задачи. Я не подменил этот пробел
  чтением молча: явно фиксирую его как находку, полагаюсь на (а) статическое
  чтение самого теста, подтверждающее, что он действительно проверяет ровно
  заявленные в АС значения (`16px`, `390px`-границы, отсутствие записи), и
  (б) задокументированные автором скриншоты/`sha256` до/после. Рекомендация:
  владельцу стоит проверить сетевой доступ `demo.local`/статическую раздачу
  в среде, где выполняется `mcp__houseplan_review__run_check`, перед
  следующим пакетным ревью ship — иначе ни одна задача с браузерным смоуком
  не получит независимого исполнения.

### Что проверено и корректно

- Диффу по продуктовому коду — ровно одна строка
  (`src/styles/editor-dialogs.styles.ts:761`), токен существует
  (`--sp-6: 16px`), соседние строки каталога/поиска/действий не затронуты.
- Смоук статически доказывает оба заявленных в ТЗ сценария (desktop,
  390px) и read-only инвариант; тест способен покраснеть (исходное
  значение давало 0px, не 16px).
- `.farhint`/`--sp-8` вне скоупа обоснованно, не новая находка (уже
  разведено в `SPEC-REVIEW-1145-r2.md`), класс риска `visual` ship не
  повышает.
- Changelog (en/ru), release-ledger и build (`build:build` passed)
  согласованы с правкой; бинарные/хешированные файлы — ожидаемое
  следствие пересборки, не отдельное изменение поведения.

### Чего не проверял

- Независимое браузерное исполнение `smoke_device_inbox.mjs` в этой среде
  (см. L2) — только статическое чтение теста и авторские
  скриншоты/`sha256`.
- Полные наборы (`gate:small`, golden-матрица, полный `npm test`/`tsc`) —
  не адресны для однострочной CSS-правки одного существующего токена;
  не запускал по §8 (предрелизный гейт, не гейт на одну задачу).
- Текст commit-трейлеров (`Issue:`/`User-Visible:`) коммитов
  `094a5cf20f`/`1f3f73f64d` — в этой среде нет инструмента для чтения тела
  отдельных коммитов (`read:log` отдаёт только `sha + subject`); судил по
  факту двух согласованных changelog-записей и release-ledger.


<!-- hp-ship-review-anchors -->
### Материал пакетного ревью

<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzIsIm91dHB1dF90b2tlbnMiOjIzMzc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwOTI2MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI5NzkyNzQsImNvc3RVc2RFc3RpbWF0ZSI6MS4yNjY3ODY4fV0sInR1cm5zIjo1NCwiZHVyYXRpb25NcyI6NTEwNjc5LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4yNjY3ODY4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
```
tag v1.83.0-beta.5
candidate 1f3f73f64df058182da626ea1588990f97279f04
base v1.83.0-beta.4
issues 1151
high 0
medium 0
low 2
run https://github.com/Matysh/houseplan-card/actions/runs/41025295114
mode beta
patches 1151:c299a1f04c9785bd69fbb2b6995deccba80ca96b+e82a4a2c81f70bdc3bfb19f8bad800d9ced12e39
```
<!-- hp:usage input_tokens=72 output_tokens=23374 cache_creation_input_tokens=109262 cache_read_input_tokens=2979274 num_turns=54 -->
