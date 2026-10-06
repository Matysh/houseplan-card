# CODE-REVIEW-792-r2

Материал: `97e6504e9cbaebca3dac7154b513e48890a4cae0` (ветка `issue/792-device-battery-indicator`).
Коммиты в диапазоне `3c091e7ef8c4..HEAD` (дельта с r1): `88bdd513e` (golden/unit-покрытие
battery×Zigbee overlap + правка EN guide), `97e6504e9` (приёмка нового эталона).
Трек: `ask`. Этап: code. Заход: r2. ТЗ — редакция 2 (тело issue #792 текстуально не менялось
с r1 — сверено построчно с §8/§10, цитаты в r1 совпадают с текущим телом issue).

## Скоуп

Повторный раунд предметен: ровно две находки r1 (Medium в скоупе — отсутствует
golden-сцена Zigbee-overlap; Low — расхождение EN USER-GUIDE с фактической строкой
тумблера) и ничего больше. Подтверждено диффом, а не заявлением автора:
`git diff 3c091e7ef8c4..97e6504e9c -- dist/ src/ custom_components/` пуст — ни
продуктовый код, ни бандл в дельте не менялись. Единственные тронутые файлы:
`demo/golden/device-battery.mjs`, `demo/golden/harness.mjs`, `demo/golden/matrix.mjs`,
`docs/USER-GUIDE.md`, `test/golden-battery.test.mjs`, `test/golden-matrix.test.mjs`,
`demo/golden/baselines/baselines-index.json` + новый PNG, и публикация
`docs/reviews/CODE-REVIEW-792-r1.md` самим конвейером.

## Как проверялось

Зелёный полный `Validate` на точном SHA материала подтверждён напрямую командой,
а не доверием к ссылке из комментария:

```
gh run view 37468962716 --repo Matysh/houseplan-card --json status,conclusion,headSha
→ {"conclusion":"success","status":"completed","headSha":"97e6504e9cbaebca3dac7154b513e48890a4cae0"}
```

`headSha` совпадает с материалом ревью побитово. Это закрывает `tsc --noEmit`,
`npm test`, `npm run build` + bundle-policy, `golden:verify` (204 PASS, было 203 +
1 новая), полный browser-smoke набор (300, 3/3 шарда) и performance smoke — их я
не перегонял.

Дополнительно я сам выполнил дешёвый точечный прогон прямо затронутых файлов (не
полагаясь только на цифру из handoff):

```
node --test test/golden-battery.test.mjs test/golden-matrix.test.mjs
→ tests 62, pass 62, fail 0
```

Совпадает с заявленным автором «62/62 PASS» — число не задвоено с расхождением.

`node demo/smoke_device_battery_zigbee.mjs` локально не прошёл запуск (таймаут
загрузки `houseplan-card.js`) — это объясняется тем, что закоммиченный `dist/`
в рабочем дереве является рекомендованным «чистым» артефактом задачи (ordinary
task restores it with `npm run bundle:clean` — AGENTS.md), а не реальной сборкой
фичи; без `npm run build` локальный demo-сервер не может отдать актуальный
бандл. Пересобирать его самому инструкция прямо запрещает («дешёвые гейты уже
подтверждены», #343). Полный Validate на этом SHA уже включает 300 browser
smoke (3/3 шарда, success) — именно там `smoke_device_battery_zigbee.mjs`
исполняется против настоящей сборки; отдельно не перегонял.

Прочитано и разобрано построчно (без исполнения, где не указано иное):

- `demo/golden/device-battery.mjs` (весь добавленный блок, 182 строки) —
  `makeBatteryZigbeeFixture` строит реальный изолированный ZHA parent/child
  (один end-device на плане, один «на плане отсутствующий» router-родитель с
  именем `Upstairs parent relay`), `prepareBatteryZigbeeOverlap` выполняет
  настоящий UI-путь: клик по шестерёнке → Refresh в Zigbee-настройках →
  ожидание ответа → Cancel/закрытие диалога → проверка, что перед наведением
  отрисован полноразмерный официальный MDI `mdi:battery` (путь SVG сверяется
  с `window.__ICONS`, не только атрибут `icon`) → hover по маркеру → ожидание
  реального текста подписи `Upstairs parent relay` → три скриншота
  (active/captionHidden/routesHidden) с восстановлением стилей в `finally`.
  `inspectBatteryZigbeePixels` — исполняемый пиксельный оракул (не сравнение
  z-index): считает реально закрытые подписью зелёные пиксели батарейки
  (`covered/ink ≥ 0.9`) и реально обнажённый route-пиксель за core
  (`exposedRoute ≥ 3`, `coreChanged ≤ 2`) по разностным кадрам.
- `demo/golden/harness.mjs`, `demo/golden/matrix.mjs` — новый capture-тип
  `battery-zigbee-overlap` подключён в `fixtureFor`/`goldenClip`/
  `prepareGoldenScenario`; сцена `device-battery-zigbee-overlap-dark` —
  `maxDiffRatio: 0` (фиксированный 420×140 фокус-кроп, а не полный кадр —
  сознательное ужесточение, снимающее риск «1px эрозии» на стыке). Версия
  матрицы `GOLDEN_MATRIX_VERSION` 72→73 согласована во всех трёх местах, где
  она утверждается (`test/golden-matrix.test.mjs` дважды, `baselines-index.json`).
- `test/golden-battery.test.mjs` — новый тест структуры сцены/фикстуры плюс
  **четыре отдельных теста пиксельного оракула с синтетическим `pixelWitness()`**,
  явно демонстрирующие, что `inspectBatteryZigbeePixels`/`batteryZigbeeClip`
  **умеют падать**: отсутствие overlap, пустая/частично закрашенная батарея
  (`/real battery ink/`), route поверх core (`/route\/core paint order/`),
  отсутствующий route-контроль, обрезанный кадр (`/truncates/`), сдвинутый
  core. Это закрывает требование «тест умеет падать» исполнением, а не
  утверждением — ревьюер сам прогнал (см. выше, 62/62).
- `demo/golden/baselines/baselines-index.json` — построчный diff подтверждает:
  добавлена ровно одна новая запись хэша (`device-battery-zigbee-overlap-dark`),
  все три прежние battery-записи и остальные 200 — байт-в-байт без изменений
  (сверено diff'ом, не комментарием к коммиту). `localAttestation.sha256`
  (`4918901746d5…`) дословно совпадает с trailer `Baseline-Reviewed-Local:` на
  `97e6504e9` — одно число, один источник.
- `docs/USER-GUIDE.md:1432` — «Show device battery charge» →
  «Show device battery status»; сверено с `src/i18n/settings/en.json:53`
  (`"gs.show_device_battery": "Show device battery status"`) — дословное
  совпадение. RU-гайд не менялся (был уже точен по записи r1).
- Трейлеры: `88bdd513e` — `Issue: #792`, `User-Visible: no` (верно: тестовая
  инфраструктура и исправление текста документации не меняют поведение
  продукта, CHANGELOG не требуется). `97e6504e9` — `Issue: #792`,
  `User-Visible: no`, `Release: v1.80.0-beta.4` (совпадает с
  `package.json: "version": "1.80.0-beta.4"` и с паттерном предыдущего
  baseline-коммита `9951e6ba1` в этой же ветке) + `Baseline-Reviewed-Local:`.
  Оба правила §3 п.10 соблюдены.
- Тело issue #792 — прочитано целиком; §8/§10 текстуально идентичны цитатам
  r1 (строка 137: «…и Zigbee-overlap» сохранена дословно), новых продуктовых
  вопросов не появилось. Комментарии issue (полная лента) — прочитаны;
  handoff-комментарий автора для r2 называет точные команды и их результаты
  для каждого утверждения, ни одно сверенное число не разошлось с тем, что я
  увидел в дереве сам.

### Риск по изменённым участкам (#707) — унаследовано, не изменилось

Классы `migration` (`validation.py:2324`, `types.ts:321`), `perf`
(`render-device-snapshot.ts:99/100/108/109/113+2`), `ux` (i18n-ключи
`gs.show_device_battery[_hint]` в de/en/fr/ru) не затронуты дельтой r1→r2
(подтверждено пустым diff'ом по `src/`, `custom_components/` выше). Разбор и
сверка с AC ТЗ выполнены в r1 и остаются в силе без повторной проверки —
см. «Унаследовано из r1» ниже. Новых рискованных участков дельта не вносит:
изменения — только golden-harness/test/docs.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: §10 требует golden-сцену Zigbee-overlap, добавлены только 3 изолированные battery-сцены, пересечение батарейки с подписью доказано только smoke | Добавлена четвёртая golden-сцена `device-battery-zigbee-overlap-dark` с реальным Zigbee-топологическим рендером (настоящий ZHA refresh + hover), `maxDiffRatio: 0`, исполняемый пиксельный оракул с явными `assert.throws` на все деградации (отсутствие overlap, невидимый MDI, обратный порядок слоёв, обнажённый route, обрезанный кадр) | `demo/golden/device-battery.mjs:208-390`, `demo/golden/matrix.mjs:900-904`, `test/golden-battery.test.mjs:66-153`; эталон принят коммитом `97e6504e9`, `baselines-index.json` строка `device-battery-zigbee-overlap-dark` |
| Low: `docs/USER-GUIDE.md:1432` цитирует «Show device battery charge», фактически «Show device battery status» | Текст приведён к фактической i18n-строке | `docs/USER-GUIDE.md:1432` ↔ `src/i18n/settings/en.json:53` |

## Унаследовано из r1

Без повторной проверки приняты (документ `docs/reviews/CODE-REVIEW-792-r1.md`,
материал `3c091e7ef8c4978303b7fecbe202b45b4193b7f5`, т.к. дельта не касается
этих файлов — подтверждено пустым diff'ом выше):

- Резолвер батареи, пороги/округление AC1, ownership AC2/AC3 (`src/device-battery.ts`,
  `test/device-battery.test.mjs`).
- Snapshot/invalidation AC4, immutable render-snapshot (`src/render-device-snapshot.ts`).
- MDI-отображение AC5 и геометрия/CSS AC6 (`src/device-battery-geometry.ts`,
  `src/styles/devices.styles.ts`, `src/device-face.ts`).
- Z-слои/интерактивность AC7 — z-index раскладка и differential-smoke
  (`src/hp-zigbee-topology-overlay.ts`).
- Lifecycle AC8 (LED active-only exclusion, disabled/orphaned/vacuum puck).
- Общая настройка AC9 — backend/frontend валидация, CAS-rollback, trailers
  (`custom_components/houseplan/validation.py`, `support_package.py`,
  `src/device-battery-settings.ts`).
- Бюджетная рекалибровка AC10 (`scripts/bundle-budget.mjs`, `docs/DEVELOPMENT.md`)
  — числа не менялись в дельте.
- Три риск-класса `migration`/`perf`/`ux` (сверены с ТЗ в r1, см. таблицу выше).
- Мутанты реестра (4 новые записи) — проверка уникальности `find`-строк, не
  исполнение (#709), не изменились.

## Что проверено и корректно (дельта r2)

- Новая golden-сцена использует **настоящий** путь: реальный клик по
  Refresh в Zigbee-настройках, реальный hover, реальная подпись родителя —
  не синтетическая подстановка DOM.
- Пиксельный оракул — исполняемая функция с полным набором отрицательных
  случаев внутри того же тестового файла; ревьюер сам прогнал (62/62 PASS) и
  прочитал каждый `assert.throws` построчно.
- Приёмка эталона — ровно одна новая запись, 200 прежних байт-в-байт
  нетронуты (проверено diff'ом индекса, не комментарием).
- Трейлеры и changelog-правило соблюдены; `Release:`/`Baseline-Reviewed-Local:`
  совпадают с версией пакета и собственной SHA индекса.
- Текст EN guide теперь дословно совпадает с кодом.
- Validate на точном материале — success, `headSha` сверен напрямую через
  `gh run view`, а не взят на веру из ссылки.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`, `npm test` (полный), `npm run build` +
  `bundle-policy --verify`, `golden:verify`, полный browser-smoke — зелёный
  Validate на точном SHA материала подтверждён напрямую (`gh run view`,
  `headSha` совпадает побитово), повторный прогон избыточен.
- `node demo/smoke_device_battery_zigbee.mjs` не выполнен локально в этой
  рабочей копии: закоммиченный `dist/` в рабочем дереве — предрелизный
  «чистый» артефакт (`npm run bundle:clean`), не реальная сборка фичи;
  пересобирать его самому вне протокола (дешёвые гейты уже подтверждены,
  #343). Этот же smoke уже исполнен Validate против настоящей сборки на этом
  SHA в составе 300 browser smokes.
- Не исполнял `python -m pytest tests_backend` — дельта r1→r2 не трогает
  Python/backend, не применимо; r1 уже закрыл этот гейт на прежнем материале
  и backend-код не менялся.
- Не исполнял мутанты реестра — не требуется в разработке ни на каком треке
  (#709); дельта не добавляет новых мутаций.
- `npm run invariants` — не применимо, дельта не трогает геометрию плана.
- Не тестировал на физическом HA/мобильном устройстве — признано автором,
  не гейт продукта для этой задачи.
- `node scripts/check-docs.mjs` — не перегонял сам; автор привёл PASS, свежесть
  docs-скриншотов не гейт задачи (#697).

## Находки

Новых находок нет. Обе находки r1 (Medium в скоупе, Low) закрыты дельтой и
верифицированы чтением и собственным прогоном затронутых тестов, а не
заявлением автора.

## Вердикт

Зелёный. Обе находки r1 закрыты и проверены независимо (diff эталонов,
собственный прогон 62/62 unit-тестов золотого харнесса, прямая сверка
`headSha` зелёного Validate с материалом ревью). Риск-классы по #707 покрыты
AC ТЗ без изменений с r1; новых рискованных участков дельта не вносит.
Понижения трека не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/792-device-battery-indicator`, коммит `97e6504e9cba` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `597f9c901995064a442d5fc38d83eccd95b7fb39`
  ```
  git log --all --format='%H %T' | grep 597f9c901995
  ```
- Тело issue: `d2db5740fe7ac7a25587a030e58ce619ae6791db06d55b8ea5905758cce925b9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4554 output_tokens=20543 cache_creation_input_tokens=91472 cache_read_input_tokens=2482413 num_turns=39 -->
