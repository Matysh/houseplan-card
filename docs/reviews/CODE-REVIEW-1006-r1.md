# CODE-REVIEW-1006-r1

Issue: #1006 · этап: code · заход r1 · блокирующих циклов 0/4 · трек: ask
Материал: `aa7ff6199fbedb39b8e111e367f26acd39316f15` (`git diff origin/dev...HEAD`,
3 коммита: `5bf441eb4` fix, `6d8ace477` test, `aa7ff6199` golden accept).
SPEC-REVIEW-1006-r1 — зелёный (High 0 / Medium 0).

## Скоуп

ТЗ (в теле issue): признак waxing/waning, уже вычисляемый `moonIllumination`,
должен дойти до маски фазы и до fingerprint, не трогая сам дизайнерский арт
(`MOON_ART`) и не поворачивая/отражая контейнер. Растущая Луна — справа,
убывающая — слева, севером вверх, на всех поверхностях (View/panel/kiosk/
static-space) и фонах (daynight/static). Диффу соответствует: `src/moon.ts`,
`src/moon-runtime.ts`, тесты, NASA-фикстура, новый browser smoke, согласованные
документы (`SUN.md`, оба `USER-GUIDE`, `ARCHITECTURE.md`, `DEVELOPMENT.md`,
`STATUS.md`, оба changelog), `release-ledger/v1.82.0/1006.json`, записи
mutation registry/inventory и 4 принятых golden-кадра.

## Как проверялось

| Гейт | Статус | Где видно |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | Подтверждено Validate на точном SHA (не перегонял) | [CI product run 39674541084](https://github.com/Matysh/houseplan-card/actions/runs/39674541084) → success, headSha = материал |
| Golden (`ci:golden`, diff трогает рендер) | Подтверждено на точном SHA | тот же run: `Golden-кадры против принятых эталонов` → success; на предыдущем коммите `6d8ace477` тот же job красный ровно по 4 заявленным moon-сценам ([run 39672735982](https://github.com/Matysh/houseplan-card/actions/runs/39672735982), `Baseline-Reviewed`) |
| Смоки, выбранные по диффу (`smoke-select.mjs`) | **Не покрыты Validate на этом SHA** — прогнал сам | см. ниже |
| Инварианты модели геометрии | Не применимо — геометрия плана не меняется, правится только SVG-маска Луны | — |
| `node scripts/mutation-gate.mjs --check` | Прогнал сам | `static-readiness: execution=0 caught=unknown (nightly only)`, 445/200 warning (не fail) — только статическая регистрация, мутанты не исполнялись |

Важная находка по объёму, не меняющая вердикт: у Validate на этом материале
(как на `aa7ff6199`, так и на предшествующем `6d8ace477`) job «Смоки в браузере»
и «Смоки: все шарды зелёные» были **skipped** — `classify-changes.mjs` вернул
`smoke.mode=none, reason="no full demand"` (видно в логе job
«Классификация изменённых файлов» обоих прогонов). То есть CI Validate в этой
задаче подтверждает только golden + тайпчек/юниты/билд, а не браузерные смоки
по диффу — именно то, что промпт ревьюера относит на меня отдельно. Поэтому я
прогнал их сам, а не положился на ссылку автора:

```
node scripts/smoke-select.mjs --base origin/dev --head HEAD
```
→ прямое совпадение `demo/smoke_moon_phase_direction.mjs` (символ `moonPhasePath`)
плюс 4 зарегистрированные связи (`smoke_moon`, `smoke_moon_static`,
`smoke_moon_status`, `smoke_daycycle_layer_budget`) — совпадает с перечнем
автора в хендоффе.

```
npm run build && node scripts/bundle-sync.mjs
node demo/smoke_moon_phase_direction.mjs
```
→ **PASS, exit 0**, все 93 проверки `true`: сторона (`*-side`) для
waxing/waning на каждой из 4 поверхностей × 2 фонов, отсутствие
transform/mirror на арте (`*-fixed-art`), host-инварианты (pointer-events,
aria-hidden, фиксированный размер), `equal-share-distinct-mask` (k=0.79 у
обеих фаз, разные доли left/right), `stable-place` (бокс не двигается),
`hemispheresKeepNorthUpCrescent` (Сидней/Москва — одна и та же маска), полный
диск (`fullProductionArtAndEdge`) и геометрическая монотонность площади для
обеих сторон на k = 0, .03, .25, .5, .75, .97, 1.

Остальные 4 смока из smoke-select (`smoke_moon`, `smoke_moon_static`,
`smoke_moon_status`, `smoke_daycycle_layer_budget`) не перегонял: связь —
«зарегистрированная», не прямое совпадение символа (в них никто не называет
`moonPhasePath`/`moonIllumination` по имени), а их область (жизненный цикл
чанка, видимость, строка статуса) не меняется этим диффом — риск и так закрыт
прямым смоком и автором в хендоффе (`gate:small -- --smokes`, 0 failures).

## Проверка AC по коду и тестам

| AC | Чем доказан | Проверено |
|---|---|---|
| AC1 (направление по реальным датам снимка владельца и NASA) | `test/moon-phase-direction.test.mjs` против `test/fixtures/moon-nasa-2026.mjs` (допуск 2.5 п.п., знак по соседним часам); `demo/smoke_moon_phase_direction.mjs` на реальных production-поверхностях | Чтением формул + исполнением browser smoke (см. выше) |
| AC2 (геометрия серпа/четверти/выпуклой, непрерывность, NaN) | Юнит-тест перебирает k у границ (0, 0.00001, 0.49999, 0.5…, 1) и сверяет sweep-флаги напрямую с формулой `moonPhasePath` | Прочитан: формула `(k > 0.5) === right ? 1 : 0` — корректная XOR-реализация «зеркала через sweep, не transform» (обе дуги делят общие точки на вертикальной оси, поэтому переворот sweep-флага меняет полуокружность без сдвига координат) |
| AC3 (арт не отражается/не поворачивается) | `demo/smoke_moon_phase_direction.mjs`: `transformed` — проверка `getComputedStyle(...).transform` и атрибута `transform` на корне/`#hp-moon-art`/`use`; diff арта/генератора пуст | `git diff` подтверждает нулевые изменения в `assets/moon/**` и генераторе; smoke зелёный |
| AC4 (все поверхности и фоны) | `demo/smoke_moon_phase_direction.mjs` перебирает View/panel/kiosk/static-space × daynight/static | Исполнено, все 93 проверки true |
| AC5 (fingerprint/lifecycle) | `test/moon-phase-direction.test.mjs`: разные k дают разный fingerprint кроме k=0/1; fake-host тики проверяют ровно одно обновление при переходе waxing→waning на том же k, ноль обновлений на обычных тиках, переход через полнолуние/новолуние | Прочитан код `moonFingerprint`/`moonTick`; логика совпадает с контрактом п.4 (единственный источник направления) |
| AC6 (документы/mutation anchors согласованы) | `docs/SUN.md`, оба `USER-GUIDE`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, changelog, `mutation-registry.mjs` (`moon-lit-side-flips` патч обновлён под новую формулу, guard тот же `--test-name-pattern="#661"` — имена тестов его сохранили) | Прочитан весь diff документации, согласован |

### Защитные AC — «чем краснеет»

AC2 защищает от регрессии геометрии. Старая `moonPhasePath(k)` (однопараметрическая)
молча игнорировала бы второй аргумент и всегда возвращала sweep=0: для
`side=true` юнит-тест `arcs[0][3] === +right` упал бы на всех k из (0,1), а
browser smoke — на любом `*-waxing-side` (всегда left). Явного registry-мутанта
не исполнял (политика), но слежение аналитическое подтверждено чтением обеих
версий формулы (`git diff`) — несовпадение однозначно. AC3 (неотражение арта)
застрахован зарегистрированным (не исполнявшимся) witness'ом
`moon-art-mirrored-1006` — id в реестре подтверждён (`scripts/mutation-registry.mjs`),
не исполнялся, что соответствует общей политике «не мутант в деле».

## Прочее по дельте

- Трейлеры: все три коммита несут `Issue: #1006`; `5bf441eb4` (единственный
  класса A/B с видимым поведением) — `User-Visible: yes` и правит оба
  changelog в этом же коммите; `6d8ace477`/`aa7ff6199` — `User-Visible: no`
  (тестовая изоляция и golden-приёмка). `aa7ff6199` трогает
  `demo/golden/baselines/**` и несёт `Release: v1.83.0-beta.1` +
  `Baseline-Reviewed: <run 39672735982>` — ссылка валидна, именно этот (упавший
  по golden) прогон и был материалом для ревью диффа/эталонов.
- Одно число — один источник: `k` (доля освещения) по-прежнему вычисляется
  единственный раз в `moonIllumination`/`moonView` и передаётся как есть в
  `moonPhasePath`/`moonFingerprint`/DOM (`data-moon-k`); `waxing` — тот же
  принцип, подтверждён тестом AC1 («including hidden views») и smoke
  (`hemispheresKeepNorthUpCrescent`). Второго источника направления в диффе нет.
  Пользовательское число (сторона фазы) не дублируется отдельным расчётом нигде.
- `docs/release-ledger/v1.82.0/1006.json`: классификация `stable-fix`
  относительно `v1.82.0` (текущий stable) — баг «всегда слева» был в релизе,
  это не внутрибетное исправление, `introducedBy` обоснованно не требуется.
  Соответствует milestone 1.83, как написано автором.
- Golden: baselines-index обновлён на все 4 заявленные сцены (ровно те, что
  названы в `browser_plan.golden.ids` при классификации CI), count witnesses
  190→191, без побочных изменений в других эталонах.
- Косметика (не находка, не открывает цикл): в `demo/golden/matrix.mjs` новая
  строка комментария перед `day-cycle-night-moon-gibbous-dark` имеет лишний
  отступ (4 пробела вместо 2 у соседних строк комментария) — Low, визуально
  не влияет ни на что исполняемое.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа.

## Чего не проверял

- Полный `npm test`/`npx tsc --noEmit`/`npm run build` + сверку трёх копий
  бандла — не перегонял: подтверждено зелёным Validate на точном SHA
  (`run 39674541084`).
- `pytest tests_backend` / HA-harness — диф не трогает Python; тот же Validate
  run содержит зелёный `Бэкенд: pytest в Home Assistant`, диффа вне
  `src/**`/`docs/**`/`test/**`/`demo/**`/`scripts/**` нет.
- Инварианты геометрии плана (`npm run invariants`) — диф не меняет геометрию
  плана/координаты, только SVG-маску декоративного слоя Луны; AC задачи такого
  гейта не называют.
- Полный Linux golden-матрикс (220/220) — не перегонял локально; полагаюсь на
  зелёный Validate-run на точном SHA плюс просмотренный автором диф-артефакт
  (`Baseline-Reviewed`), который я тоже открыл (run 39672735982, job
  «Golden-кадры...» → failure по ровно 4 ожидаемым сценам).
- Реальное GPU/браузерное визуальное восприятие владельцем — добровольно,
  не гейт ревью (REVIEWER.md, #929); headless pixel-smoke не выдаётся за него.
- Остальные 4 смока из smoke-select (`smoke_moon`, `smoke_moon_static`,
  `smoke_moon_status`, `smoke_daycycle_layer_budget`) — не перегонял сам
  (обоснование в разделе «Как проверялось»); автор прогнал их локально
  (`gate:small -- --smokes`, 0 failures).

## Маршрут

`route: fix` (трек `ask`, поле `route` фиксировано промптом).

## Побочные находки

Побочных находок нет (политика `mode=issues`, новых issue не заводил).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1006-moon-phase-direction`, коммит `aa7ff6199fbe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b22866336da6fedf584b52dd00fe4ebfd8daf116`
  ```
  git log --all --format='%H %T' | grep b22866336da6
  ```
- Тело issue: `85c345b6837c87840b20368052768c1d6a78f6cbca3fd3dd0e074c42757dddb4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3ODUsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODk1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4NCwib3V0cHV0X3Rva2VucyI6MzAyMzcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM5MDAzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDU1NzcxMiwiY29zdFVzZEVzdGltYXRlIjoxLjc3MDA5MjQwMDAwMDAwMDJ9XSwidHVybnMiOjUzLCJkdXJhdGlvbk1zIjo0MjgyODgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjc3NDk4NzQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4869 output_tokens=30259 cache_creation_input_tokens=139003 cache_read_input_tokens=4557712 num_turns=53 -->
