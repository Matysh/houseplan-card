# CODE-REVIEW-881-r1

Issue: #881 · Трек: show · Заход: r1 · блокирующих циклов использовано 0 из 2
Материал: `9c97952d57263ba63ec503e340406e2080220570` (`issue/881-scene-repaint`,
база `240c69e09fc9cdc55e32c538fb77f4be1da8ecab`)

## Скоуп

Диапазон `origin/dev..HEAD` — два коммита:

- `075028cb` test(golden): repaint only the opted-in battery Zigbee overlap scene
- `9c97952d` test(golden): accept the reviewed fully repainted overlap frame

Файлы: `demo/golden/run.mjs`, новый `demo/golden/scene-repaint.mjs`,
`demo/golden/README.md`, один обновлённый PNG + `baselines-index.json`,
`test/golden-scene-repaint.test.mjs` (новый), `test/source-fingerprint.test.mjs`,
`scripts/mutation-registry.mjs` (два новых мутанта), `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/release-ledger/v1.80.1/881.json`. Продуктового кода
(`src/**`, Python) нет — это инфраструктурная задача классов B/D ровно по
контракту ТЗ (вариант **б** владельца: scene-local repaint, без новых
Chromium flags). Работа обслуживает тестовую инфраструктуру, упомянутую в
`docs/SCOPE.md` лишь косвенно (стабильность golden-гейта, который защищает
J1–J7 от регрессий отрисовки) — это ожидаемо для `track:infra/show`, не
находка.

## Маршрут по §5

- **complexity** — одна функция-обёртка, условие по точному `scenario.id`,
  try/finally восстановления. ≤3. Проходит.
- **surfaces** — одна поверхность: раннер golden-гейта и эталон одной сцены.
  Проходит.
- **migration** — нет конфига, нет полей совместимости. Проходит.
- **ux-contract** — нет видимого пользователю поведения; продукт не тронут.
  Проходит.
- **perf-touch** — не затронуты (ТЗ прямо исключает touch/perf продукта,
  задета только длительность CI-джоба, см. ниже). Проходит.
- **undocumented** — ожидаемое поведение зафиксировано: решение владельца
  (вариант б) — в теле issue; контракт repaint — в этом же коммите
  (`demo/golden/README.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`).
  Проходит.

Все шесть критериев пройдены → `route: fix`.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build`+`bundle-policy --verify` | **Принято по ссылке** | Validate [38545249428](https://github.com/Matysh/houseplan-card/actions/runs/38545249428) — `headSha` сверен `gh run view --json headSha` = точный материал `9c97952d…`, `conclusion: success`; job «Фронтенд: типы, юниты, мутанты, синхрон бандла» = success. Не перегонял сам (#343). |
| `golden:verify` (`ci:golden`) | **Подтверждён на точном SHA** | Тот же Validate-run, job «Golden-кадры против принятых эталонов» = success (205/205 на принятом эталоне). Дополнительно сверил первый полный прогон [38543101133](https://github.com/Matysh/houseplan-card/actions/runs/38543101133): `headSha` = `075028cb…` (коммит до приёмки), golden-job `failure` — ожидаемое состояние (единственный известный sanctioned diff на цели, до `golden:accept`). Обе цифры совпадают с рассказом автора. |
| `node --test test/golden-scene-repaint.test.mjs test/source-fingerprint.test.mjs` | **Прочитан, не исполнен отдельно** | Покрыт тем же `npm test` в Validate-job выше; дополнительно прочитал тест построчно (см. AC1). |
| Мутанты по диффу | **Не прогонял — не положено на `show`** | REVIEWER.md «Трек show»: мутанты в разработке не исполняются ни на одном треке; проверил только, что оба новых мутанта **зарегистрированы** в `scripts/mutation-registry.mjs` и их `find`-паттерн встречается в `demo/golden/scene-repaint.mjs` ровно один раз (статически, чтением). |
| Смоки в браузере / perf-смок / геометрия TS/Python / pytest backend | **Пропущены штатно** | Та же Validate: все три — `skipped`, потому что диапазон не содержит `src/**`/Python/геометрии; AC задачи не называют смоки. Решение классификатора не перепроверял отдельно — нет оснований сомневаться при нулевом продуктовом диффе. |
| Инварианты модели | **Не применимо** | Геометрия не тронута. |
| Визуальная сверка эталона | **Сделал сам** | Открыл `demo/golden/baselines/device-battery-zigbee-overlap-dark.png` — обычный кадр батарейного устройства с tooltip «Device is not on the plan» и зелёной Zigbee-связью; видимых артефактов/обрезков/чёрных областей нет. |

## AC — разбор

**AC1 (локальный repaint-контракт, защитный AC).** Прочитан
`demo/golden/scene-repaint.mjs` и `test/golden-scene-repaint.test.mjs`
построчно (не исполнял отдельно от Validate `npm test`).
`captureGoldenFrame` срабатывает только при точном `scenario.id ===
'device-battery-zigbee-overlap-dark'`; временный цвет гарантированно
отличается от текущего вычисленного фона (`background === 'rgb(1,2,3)' ?
'rgb(3,2,1)' : 'rgb(1,2,3)'`), выставляется с `'important'`, ждёт два кадра,
в `finally` восстанавливает точное `value`/`priority` (включая случай
отсутствующего свойства — `if (value)` отличает `''` от любого непустого
значения) независимо от исхода ожидания, и только при успехе ждёt ещё два
кадра перед обычным `page.screenshot`. Тест:
- исполняет настоящий callback через `page.evaluate` (не regex/строка);
- проверяет все 204 прочих сцены не вызывают `evaluate`/repaint
  (`otherScenes.length === 204`, `evaluations === 0`);
- проверяет восстановление при падении на каждом из 4 кадров/снимка — обе
  ветки `value`/`priority` (включая пустую);
- проверяет, что при уже совпадающем фоне temp-цвет всё равно меняется, и
  при падении `screenshot` временное значение не утекает.

AC · чем доказано · чем краснеет:

| AC | Чем доказано | Чем краснеет |
|---|---|---|
| AC1 | `test/golden-scene-repaint.test.mjs` (4 теста, см. выше), прогнан в составе Validate `npm test` на точном SHA | `golden-overlap-forgets-scene-repaint` (патч `if (false)`) и `golden-repaint-leaks-to-other-scenes` (патч `if (true)`) — оба зарегистрированы в `scripts/mutation-registry.mjs`, `find` встречается в файле ровно один раз; статически проверено чтением, исполнение — ночной прогон (#709, трек `show` их не гоняет) |

Третий столбец не пуст — Medium по §2.7 не открывается.

**AC2 (повторяемость на пине).** Разобрано чтением доказательств автора плюс
независимая сверка двух CI-прогонов (таблица выше): `075028cb` → golden
`failure` с известным единичным diff до приёмки, `9c97952d` → golden
`success` 205/205 после приёмки. 10 отдельных browser-process захватов на
Chromium151.0.7922.34 и их единый SHA256 — заявление автора, вне репозитория
(`/home/matysh/hp881-evidence-20261014-0924/`), независимо не переисполнял:
перегонять 10 отдельных Chromium-процессов — дорогой гейт, не входящий в
«дешёвые», а оба связанных с материалом CI-прогона дают согласованную
картину (ожидаемый красный до приёмки → зелёный 205/205 после). Разобрано по
коду и зафиксированным CI-артефактам, не переисполнено с нуля.

**AC3 (узкая приёмка из полного CI).** Подтверждено: индекс
(`baselines-index.json`) указывает реальный `run: 38543101133`,
`sha: 075028cb…` — это CI-прогон, артефакт которого визуально проверялся
перед `golden:accept` (соответствует `Baseline-Reviewed:` на коммите
`9c97952d`, который указывает именно на этот run — корректно: ревью
артефакта делалось по прогону с ещё не принятым эталоном, а не по
подтверждающему прогону после приёмки). Эталон сменился только у
`device-battery-zigbee-overlap-dark` (единственная строка diff в
`baselines-index.json`'s `scenarios` помимо служебных полей); `witnesses`
98/floor10 — выше порога. Финальный Validate на точном принятом SHA зелёный
205/205 (таблица выше) — «следующий полный Validate зелёный» выполнен.

## Трейлеры и ledger

- Оба коммита несут `Issue: #881`, `User-Visible: no` — изменение
  действительно не видно пользователю (только тестовая инфраструктура),
  changelog не требуется и не тронут. Корректно.
- Коммит эталона дополнительно несёт `Release: v1.81.0-beta.1` и
  `Baseline-Reviewed: <реальный run URL>` — формат соответствует требованию
  для коммитов, трогающих `demo/golden/baselines/**`.
- `docs/release-ledger/v1.80.1/881.json`: `category: infra`, без
  `introducedBy` (не правка новой бета-функции, а новая инфраструктурная
  задача) — корректно, не попадает в пользовательский milestone релиза
  (#838).
- Одно число, которое в этом диффе видно дважды (§8): SHA256 цели
  `041fd3775ebe54dd2ac84ce9db657057d455cbd4d1c65b6644d7b3b396bade65`
  записан в `baselines-index.json.scenarios` и повторно совпадает с тем, что
  называет сам PNG-файл эталона (его содержимое) и с `expect-change`,
  названным в ТЗ/AC3 — источник один: принятый CI-артефакт конкретного run.
  Расхождений не нашёл.

## Находки

Нет High. Нет Medium.

## Чего не проверял

- Не перегонял `tsc --noEmit`/`npm test`/`npm run build`/`bundle-policy`
  отдельно — приняты по зелёному Validate на точном материале (#343).
- Не перегонял `golden:verify` локально — подтверждён тем же Validate-run'ом
  (job успешен на точном SHA) плюс независимой сверкой предыдущего
  прогона.
- Не исполнял мутанты `golden-overlap-forgets-scene-repaint` /
  `golden-repaint-leaks-to-other-scenes` — трек `show` их не прогоняет,
  ловлю проверит ночной реестр (#709); проверил только регистрацию и
  уникальность `find`-паттерна.
- Не переисполнял 10 отдельных browser-process захватов с Chromium на пине —
  дорогой гейт вне бюджета ревью; принял по согласованности двух реальных
  CI-прогонов на связанных SHA (таблица выше).
- Браузерные смоки/perf-смок/геометрию/pytest backend не прогонял — они
  `skipped` в Validate на материале без продуктового диффа и не названы в AC.
- Не проверял независимо гипотезу про историю partial raster в Chromium
  (AA-геометрию компоновки) — это диагностическое объяснение владельца и
  автора, не часть AC; проверил только поведенческий контракт (AC1) и факт
  согласованных CI-результатов (AC2/AC3).

## Вердикт

Диапазон `origin/dev..HEAD` на `9c97952d57263ba63ec503e340406e2080220570`
полностью соответствует рабочему контракту из тела issue (вариант владельца
б): repaint ограничен точным ID одной сцены, остальные 204 без изменений,
Chromium flags/фикстуры/семантика/пороги не тронуты, защитный AC1 покрыт
тестом и зарегистрированными мутантами, AC2/AC3 подтверждены реальными
CI-прогонами на точных SHA, трейлеры и ledger корректны. Маршрут проходит
все критерии §5 → `route: fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/881-scene-repaint`, коммит `9c97952d5726` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7a5c9bdf4cae426d5575278ac90b0352a4bb9988`
  ```
  git log --all --format='%H %T' | grep 7a5c9bdf4cae
  ```
- Тело issue: `ce0713736bfa193225adabba238257c4191d7e2430f61fc15ea5fcc432faa0dc`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTIsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njg2OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozNCwib3V0cHV0X3Rva2VucyI6MjA2NDQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzUyNjgsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMTg5OTk5LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzQ1NTc5OH1dLCJ0dXJucyI6MjMsImR1cmF0aW9uTXMiOjI1Mjg3OSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzUwMjY2OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4626 output_tokens=20663 cache_creation_input_tokens=75268 cache_read_input_tokens=1189999 num_turns=23 -->
