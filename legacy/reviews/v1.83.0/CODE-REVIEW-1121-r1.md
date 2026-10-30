# Код-ревью #1121 — заход r1

**Материал:** `2b5c4e92d39d0927861bc839b12ca11a3f6c87c6` (единственный коммит в диапазоне `origin/dev..HEAD`: `fix(tooling): preserve descendant pseudo-selector whitespace`).
**Трек:** show. **Этап:** code.

## Скоуп

Минификатор статических Lit `css` templates (`scripts/css-template-minifier.mjs`) удалял значимый пробел перед `:` безотносительно того, начинается ли этим двоеточием псевдоселектор-потомок (`.a :is(.b)`) или объявление (`color: red`). Правка:

- убирает `':'` из множества `TIGHT_BEFORE` (пробел перед `:` больше не схлопывается безусловно), оставляя `':'` в `TIGHT_AFTER` (пробел после `:` по-прежнему схлопывается — обычные объявления остаются компактными);
- добавляет адресные unit/plugin-кейсы в `test/bundle-assets.test.mjs`;
- расширяет существующий нативный браузерный смок `demo/smoke_css_minifier_semantics.mjs` управляемой fixture с descendant/self pseudo-селекторами и реальным наблюдением `display`/`content` в shadow DOM;
- документирует фикс в `docs/DEVELOPMENT.md`/`docs/STATUS.md`, заводит `docs/release-ledger/v1.82.0/1121.json` (`category: infra`) и генеративно обновляет `scripts/ci-registry-inventory.json`.

Продуктовые CSS-источники (`src/styles/**`) не менялись — фикс целиком в B/C-поверхности инструментария сборки.

## Как проверялось

1. **Независимый разбор алгоритма** (`scripts/css-template-minifier.mjs`) построчно: проследил оба прохода (`pendingSpace`/`TIGHT_BEFORE`/`TIGHT_AFTER`) для всех сценариев из issue и тестов — descendant-пробел перед `:is()`/`:hover`/`::before`/`:where()`/`:not()`/`:has()`, объявление `color : red`, комментарий между селекторами, `@supports selector(...)`. Логика корректна: убор `':'` из `TIGHT_BEFORE` — единственное минимальное изменение, устраняющее баг, без затрагивания других tight-правил (`{`,`}`,`;`,`,`,`>`,`)`).
2. **Пересобрал дерево и прогнал адресные гейты через `run_check`** (манифест `440710e3...`):
   - `build:build` → PASS (44.7s) — нужен для тестов, читающих `dist/`.
   - `unit:test/bundle-assets.test.mjs` → до билда 12 тестов падали на `ENOENT dist/...` (окружение, не материал); после `build:build` — **44/44 PASS**, включая `#1121 descendant whitespace before pseudo classes/elements remains significant` (8 селекторов, идемпотентность, `color : red` → `color :red`, plugin `coverage=false/true`, fail-closed на интерполяции).
   - `unit:test/coverage-maps.test.mjs` → **2/2 PASS** (46 вместе с bundle-assets — совпадает с заявкой автора).
   - `build:bundle:sync` → PASS (нужен для нативного смока, видящего собранный бандл).
   - `smoke:demo/smoke_css_minifier_semantics.mjs` → сначала упал (`Failed to fetch ... houseplan-card.js`, не было `bundle:sync`), после `build:bundle:sync` — **PASS**: `filesCompared:13, rulesCompared:1160, everyRuleIdentical:true, savedBytes:64791, savesRealBytes:true, descendantReferenceHasEffect:true, descendantNativePaintEquivalent:true`. Это нативное доказательство: эталонная fixture (не минифицированная) реально скрывает `.glow-pools-frame`/`.led-fields` и красит `.caption`/`::before`/`::after`, как ожидается, а минифицированный результат даёт **идентичный** `computedStyle`/`content` — т.е. баг из issue (потерянный `display:none` на потомке) исправлен и подтверждён браузером, а не только текстовым сравнением.
   - `static:ci-registry-inventory` → PASS (сгенерированный инвентарь с добавленным `1121.json` согласован).
   - `static:status-snapshot` → FAILED (`snapshot block is stale`). Прочитал `scripts/status-snapshot.mjs`: `--check` **намеренно не гейт CI** («на shallow-checkout тегов нет, а счётчик тестов меняется с каждой задачей» — коммент в самом скрипте, строки 17–19). Это не находка по #1121: свежесть этого сгенерированного блока не является гейтом задачи, расхождение из-за локального состояния тегов/окружения ревью, не продуктовый дефект.
3. **Сопоставление с хендоффом**: автор заявляет те же 44/46/13/1160 PASS и `savesRealBytes`/`descendantNativePaintEquivalent` — цифры совпали при независимом перезапуске через runner.
4. **Reuse:** `validate-gate` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/40833901236) принят как authority для полного пререлизного объёма; адресно перепрогнаны только точки, где CI-evidence не покрывал конкретно этот AC в отрыве от build/bundle-sync окружения ревью (см. выше).

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Пробел-потомок перед псевдоселектором (`:is`/`:hover`/`::before`/`:where`/`:not`/`:has`/`@supports selector()`) не схлопывается | `unit:test/bundle-assets.test.mjs` (новый кейс, 8 селекторов) — PASS; нативно — `smoke:demo/smoke_css_minifier_semantics.mjs` (`descendantNativePaintEquivalent:true`) — PASS | Обычный вход на неисправленном `TIGHT_BEFORE` (который содержал `:`) убирал бы этот пробел — воспроизведено в issue текстом; алгоритмически проверено чтением (мутация продукта для повторного запуска запрещена вне ночного workflow) |
| `color : red` остаётся валидной декларацией (пробел перед `:` в объявлении тоже сохраняется, но после `:` схлопывается) | тот же unit-кейс: `'.parent:hover::before { color : red; ... }'` → `'...{color :red;...}'` — PASS | Старое поведение стирало пробел перед `:` безусловно — тот же источник бага |
| Интерполяция остаётся fail-closed, оба режима coverage работают | тот же unit-кейс (`assert.throws(... /interpolated css template/)`, `coverage:[false,true]`) — PASS | Обычный вход с `${value}` — подтверждённый throw |
| Продуктовые CSS-таблицы не меняют семантику (регрессия не внесена) | `smoke:demo/smoke_css_minifier_semantics.mjs`: 13 файлов / 1160 правил, `everyRuleIdentical:true`, `savesRealBytes:true` | Любое расхождение правил или недостаточная экономия байт красит `mismatches`/`savesRealBytes` |

## Проверено и корректно

- Точечность фикса: только `TIGHT_BEFORE` лишилось `':'`; `TIGHT_AFTER` не тронут — не вносит сопутствующих изменений compactness объявлений.
- Тесты реально умеют падать (не tautology): 8 селекторов из `#1121`-кейса плюс идемпотентность, плюс нативное наблюдение `display`/`content` в shadow DOM на реальном SVG-дереве — не просто текстовое сравнение, а `getComputedStyle`.
- Релизный ledger (`docs/release-ledger/v1.82.0/1121.json`, `category: infra`) соответствует характеру правки (B/C-инструментарий, не продуктовый UI, #1119 ещё не выпущен) — согласуется с требованием #838 не включать инфра-правки в пользовательский milestone.
- `User-Visible`/changelog: диффа в `docs/CHANGELOG*.md` нет — согласуется с тем, что видимое поведение продукта не меняется (минификатор правит внутренний build-инструмент, не выпущенные стили).
- Критерии §5 трека `fix` выполнены: сложность ≤3, одна поверхность (один скрипт-минификатор), миграций/compat-полей нет, нового UX-контракта нет, производительность/touch не затронуты, ожидаемая CSS-семантика (descendant combinator) — стандартная, не «неописанное» поведение продукта. → `route: fix`.

## Чего не проверял и почему

- Полный `npm run gate:small`/e2e/golden-наборы — не перезапускал: это предрелизный объём (PROCESS.md §8), а не гейт ревью; `validate-gate` на этом же SHA уже зелёный, диапазон риска (минифаер + его тесты + нативный смок) адресно перепроверен выше.
- `build:typecheck` не гонял отдельно: диффа в `.ts`-файлах нет (только `.mjs`/`.md`/`.json`), типы не затронуты, перепроверка не покрывает новый риск.
- Корректность значения «Latest prerelease tag: v1.83.0-beta.2» в сгенерированном `docs/STATUS.md` не выяснял до конца (нужен был бы `git log` по тегам beta.2/beta.3, что вне доступных read-only чеков) — не блокирую, так как сам скрипт `status-snapshot.mjs` явно документирует: `--check` не гейт CI из-за shallow-checkout/счётчика тестов (строки 17–19 скрипта).

## Побочные находки

Побочных находок вне скоупа #1121 нет.

## Маршрут публикации

Политика побочных находок: `mode: issues`, `round: 1`. Побочных Medium нет → `outside_findings` пуст.

## Вердикт

Зелёный. Фикс минимален, корректен по независимому разбору, подтверждён как текстовыми unit-тестами, так и нативным браузерным наблюдением `computedStyle`/`content` на реальном дереве — именно тем способом, которым в issue был зафиксирован симптом. Регрессий в продуктовых таблицах стилей не внесено (1160 правил, побайтовое совпадение CSSOM). `route: fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjBhN2FlOTkyMGE0MDIzMzdkNDE5MTZjNjhiODYxNjFhYTVkOTUxMDdmNWFmZTk0MGQ3Yzk2ZGU2ZDBlOWRhZDEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjOThmOGIwZTQ2Njg0NGQ2ZGE0OGFiODcyNGEwZGY5MTI0MGY0NWI5M2IxMzYyNDI3ZDlhMGVhNmJjMGMwNWNjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyYjVjNGU5MmQzOWQwOTI3ODYxYmM4MzliMTJjYTExYTNmNmM4N2M2IiwidHJlZSI6ImE3OGJjOGMzYTUwNDRlOWQ2MjY0YTdlZDY5NDJjNGMwN2QxNzAzNTciLCJib2R5RGlnZXN0IjoiZjdiZWY4ZWRmZGFlZGY0YzQxNGJkZTI3ZDMwNzQ4YmE3NGFlNGFjNmE0NDVjNWZkYmZlNDYxNzlhZWIzYmQxNCIsInByb2R1Y2VyUnVuIjoiNDA4MzQ2NjkzNTIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjJjODJiMDc0ODc1NmQyMjRmODZhYjZhZGQzYWJlN2NjY2RhNmFjZGY0ZTgyNzc0MGJmOGI3ZjM1NmE5OWI1YjgiLCJ2ZXJkaWN0RGlnZXN0IjoiOTYxNTMxZDhlNTNkMDZjZWNkNGVmYTQzYWU5Nzc1MjdlODBjNjY1Zjc5NDliZDdiY2ViNDczNjBkNzE4NmM4OSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlMGY2NjYzZGNhNGYyYjI0OTY2OTkzNDI4NjExZjg1NzU0NDc2ZjEyNGM4ZmZmNGNjNDAwZTY2MTE1YjM4ZjU0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDkwNzI4MTMwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIxI2lzc3VlY29tbWVudC02NDkwNzI4MTMwIiwiYm9keURpZ2VzdCI6ImZkNzBiMDQ1MTZmYTUzYjc0M2VkZjgzNjkzZGEwMTA5YzY3M2QzMGM2YjUzMzk2ZmE5Y2FhMWE1ZDdiMGFhM2MifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1121-css-descendant-space`, коммит `2b5c4e92d39d` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a78bc8c3a5044e9d6264a7ed6942c4c07d170357`
  ```
  git log --all --format='%H %T' | grep a78bc8c3a504
  ```
- Тело issue: `f7bef8edfdaedf4c414bde27d30748ba74ae4ac6a445c5fdbfe46179aeb3bd14`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40834669352,"run_attempt":1,"digest":"fb1c75dc604d4a8a0e455c73846b2cd9cd4f6be8d2affbb3994691ad50f8c93d"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjI3MTI4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyOTI3MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1OTU1MTgsImNvc3RVc2RFc3RpbWF0ZSI6MS4zMDc1ODc2fV0sInR1cm5zIjo0NiwiZHVyYXRpb25NcyI6NDc0MzEwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zMDc1ODc2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=27128 cache_creation_input_tokens=129270 cache_read_input_tokens=2595518 num_turns=46 -->
