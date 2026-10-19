# CODE-REVIEW-967-r1

Issue: [#967](https://github.com/Matysh/houseplan-card/issues/967) — `smoke_editor_styles_lazy`: CDP garbage-collects
the action promise when opening the room dialog.
Трек: `track:show` (владелец). Этап: code. Заход r1, блокирующих циклов 0/2.
Материал: `ccde557dafbcc6f9037b1adc1b5e56839320f37a` (рабочая копия на этом SHA,
`git diff origin/dev...HEAD` — 6 файлов, 222 вставки / 2 удаления, только класс B/C).
Политика побочных находок: trusted snapshot `mode=issues` (prepare,
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`), совпадает с `REVIEW_FINDINGS_POLICY`.

## Скоуп

Issue описывает один наблюдённый отказ `demo/smoke_editor_styles_lazy.mjs` в
полном Validate (`page.evaluate: Resulting promise was garbage collected`,
`check.open` при открытии `hp-dialog.roomdialog`) — класс гонки между CDP
`Runtime.awaitPromise` и V8 GC, когда `page.evaluate(action)` возвращает
promise, ничем не удерживаемый со стороны JS. Задача (инфраструктурный
маршрут §1, класс только B/C) добавляет:

- `demo/helpers/retained-page-action.mjs` — `evaluateRetainedAction`: вместо
  прямого `page.evaluate(action)` действие оборачивается в объект-«owner»,
  удерживаемый публичным `JSHandle` (`page.evaluateHandle`); готовность
  читается поллингом `page.waitForFunction(state => state.status !== 'pending')`,
  значение/ошибка — синхронным `holder.evaluate(...)` уже после settle,
  то есть pending promise через CDP никогда не возвращается. Именованный
  предел 20 с (тот же, что у `frameOf`), оба handle освобождаются в `finally`.
- `demo/smoke_editor_styles_lazy.mjs` — единственный уязвимый вызов
  (`session.page.evaluate(check.open)` в family-loop, line 508→556) заменён на
  `evaluateRetainedAction`; добавлен блок на обычном pinned Chromium, который
  обычным (без патчей продукта/гарда) `weakActionOwner` + `HeapProfiler.collectGarbage`
  воспроизводит класс отказа (`unrootedActionShowsCdpCollection`), подтверждает,
  что retained-вариант переживает тот же GC (`retainedActionSurvivesCdpCollection`),
  и что owner освобождается после завершения (`retainedActionReleasesItsOwner`).
- `test/retained-page-action.test.mjs` — 6 юнитов на реальной (не
  замоканной под тест) реализации: pending/once/disposal, sync-once,
  sync-throw без handle, rejection identity, named timeout на зависшем
  действии, invalid input.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — описание механизма и
  регенерированный snapshot счётчиков; `docs/release-ledger/v1.81.0/967.json`
  — классификация `infra`, без milestone.

Это узкая, одноповерхностная правка тестового харнеса без изменения
продукта, конфигурации, версий, workflow, пинов или эталонов.

## Как проверялось

| Гейт | Результат | Комментарий |
|---|---|---|
| `tsc --noEmit` / `npm run build` | не перегонял отдельно | подтверждён зелёным Validate на этом SHA ([run 39267126802](https://github.com/Matysh/houseplan-card/actions/runs/39267126802)); `npm run build` выполнен мной как побочный шаг для сборки `dist/` под собственный прогон смока — PASS, 31.5 с |
| `npm test` (4910 юнитов) | не перегонял отдельно | подтверждён тем же зелёным Validate; `tsc -p tsconfig.test.json` + `fix-test-build.mjs` выполнены мной как подготовка `test-build/` для смока — без ошибок |
| `node --test test/retained-page-action.test.mjs` | **сам прогнал: PASS** | 6/6, 0 failures, 88 мс — ровно то, что заявлено |
| `node demo/smoke_editor_styles_lazy.mjs` (сам smoke из AC1/issue) | **сам прогнал: PASS** | после `npm run build` + `node scripts/bundle-sync.mjs` (синк `dist` → `demo/srv/assets`, обязательный шаг для чистого дерева) — 45/45 `true`, включая `unrootedActionShowsCdpCollection: true`, `retainedActionSurvivesCdpCollection: true`, `retainedActionReleasesItsOwner: true` и все 42 исходных AC2/AC3/AC5/AC7-проверки; `OK`, exit 0 |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **сам прогнал** | «Исполняемого frontend-диффа нет» — `src/**/*.ts` не тронут, 6 файлов диффа; browser-smoke этим скриптом не выбираются (ожидаемо для B/C-правки); адресный запуск сделан вручную выше именно по AC1 |
| `node scripts/mutation-gate.mjs --check --changed=origin/dev..HEAD` | **сам прогнал: PASS** | static-readiness, execution=0, caught=unknown — согласуется с ночным-только исполнением; `editor-styles-adoption-dropped-from-runtime` и `editor-styles-adopted-once-per-page` — `ok` (зарегистрированы, не исполнялись, как и заявлено в таблице AC1) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | **сам прогнал: PASS** | 1 коммит, 1 ожидаемое WARN §562 (инфраструктурный диапазон без S-метки до S7) |
| `node scripts/status-snapshot.mjs` (без `--write`) | **сам прогнал** | вывод побайтово совпадает с зафиксированным блоком `docs/STATUS.md` (Node unit 4910 и т.д.) — число не оторвано от генератора |
| `git diff --quiet -- src custom_components scripts/monolith-baseline.json` | **сам прогнал: пусто** | класс A/D не задет |
| `git diff --check origin/dev...HEAD` | **сам прогнал: пусто** | без пробельных ошибок |
| `golden:verify`, `pytest tests_backend`, `invariants`, `performance` | не прогонял | нет `ci:golden`, нет правок Python/геометрии, performance не названа в AC — неприменимо по §8 |

Не исполнял ни одного мутанта и не патчил продукт/гард/лимит/тестовую сборку
временно — только обычная сборка, обычные тесты и адресный прогон
неизменённого смока (общая политика выше).

## Находки

Находок нет — ни High, ни Medium, ни Low.

Разобранные риски, которые не стали находками (опровергнуты чтением и/или
прогоном):

- **Надёжность GC-контроля.** `unrootedActionShowsCdpCollection` требует,
  чтобы форсированный `HeapProfiler.collectGarbage` действительно собрал
  ничем не удерживаемый promise и чтобы текст ошибки CDP совпал с эталоном —
  то есть пройденный `checkAll` зависит от реального срабатывания сборки
  мусора в однократной попытке без ретраев. В исходном баге гонка была редкой
  (один отказ, потому что promise обычно резолвится почти мгновенно и окно
  гонки крошечное). Здесь `weakActionOwner` намеренно держит promise
  незавершённым до явного вызова `resolve`, убирая временное окно гонки:
  объект гарантированно не имеет живых ссылок всё время, пока тест не
  решит иначе, поэтому форсированный полный GC собирает его детерминированно,
  а не по удаче. Проверено прогоном: в независимом окружении (эта сессия,
  не окружение автора) все три witness прошли с первого раза. Остаточный
  риск не нулевой (поведение V8 не документировано как 100%-гарантия на
  каждый билд), но не является находкой — только пункт watch-листа.
- **Встраивание исходника действия строкой.** `Function.prototype.toString.call(action)`
  попадает в шаблонную строку без экранирования; обратная кавычка в теле
  `action` сломала бы генерируемый код. Среди всех нынешних `check.open`/
  `check.prepare` в файле обратных кавычек нет (проверено `grep`), риск
  теоретический и ограничен тестовым кодом (не продукт, не внешний ввод).

## Что проверено и корректно

- **Механизм исправления** — `evaluateRetainedAction` не возвращает pending
  promise через CDP ни разу: IIFE в `page.evaluateHandle` возвращает плоский
  объект `state` (не промис), а settled-результат читается уже после того,
  как `state.status !== 'pending'`; это подтверждено и чтением, и реальным
  исполнением (`retained-page-action.test.mjs`, где фикстура явно проверяет,
  что через «CDP»-границу не пересекает ни один thenable).
- **AC1** (сохранены 42 исходные проверки, ordering watcher-before-action не
  меняется) — проверено чтением (единственная замена — сама строка вызова
  `check.open`) и исполнением: 45/45 PASS включая все исходные ключи вывода.
- **AC2** (ровно один вызов действия, значение/ошибка без маскировки,
  зависание — отказ, оба handle освобождаются, именованный предел = пределу
  `frameOf`) — доказано исполнением 6 юнитов на настоящей реализации
  (throw/reject/timeout/invalid input — подлинные отрицательные пути, не
  примитивный мок) и нативным GC-контролем на пиновом Chromium.
- **AC3** (только B/C, без изменения продукта/версий/workflow/пинов/эталонов/
  порогов; мутанты не исполнялись) — подтверждено `git diff --quiet` по
  `src`/`custom_components`/`monolith-baseline.json`, `mutation-gate --check`
  (execution=0) и чтением диффа workflow/version файлов (не тронуты).
- Трейлеры коммита: `Issue: #967`, `User-Visible: no` — верно для
  инфраструктурной правки без видимого эффекта; changelog не требуется и не
  тронут.
- `docs/release-ledger/v1.81.0/967.json`: `category: infra`, без
  `introducedBy` — соответствует характеру правки (ремонт существующего
  тестового харнеса, не беты-фичи); формат совпадает с соседними записями
  (#960–#966).
- `docs/STATUS.md`/`docs/DEVELOPMENT.md` обновлены в этом же коммите,
  описание соответствует коду; счётчик тестов регенерирован, а не вписан
  руками (перепроверено запуском генератора).
- Маршрут §5 (трек show, `route`): complexity — низкая (локализованная
  замена одного вызова + вспомогательный модуль); surfaces — одна
  поверхность (тестовый харнес открытия поверхностей editor); migration —
  нет; ux-contract — нет, продукт не тронут; perf-touch — нет влияния на
  продуктовую производительность/touch; undocumented — ожидаемое поведение
  зафиксировано в этом же коммите (`docs/DEVELOPMENT.md`) и в теле issue.
  Все критерии §5 пройдены → `route: fix`.

## Чего не проверял

- Полные `npm test` (4910) и `npm run build` с трёхкопийной сверкой бандла
  целиком не перегонял — приняты по зелёному Validate на этом же SHA
  (инструкция ревью, #343); вместо этого выполнил только узкие шаги
  (`tsc --noEmit`/`rollup`, `tsc -p tsconfig.test.json`+`fix-test-build`),
  нужные как побочная подготовка для собственного прогона смока.
  Повторного полного прогона не делал.
- `golden:verify`, `pytest tests_backend`, `npm run invariants`, performance —
  не прогонял: диапазон не трогает рендер/Python/геометрию, performance не
  названа в AC (§8, предрелизный гейт — не гейт ревью).
- Остальные 2 шарда browser-smoke (396 сценариев суммарно) не перегонял —
  вне диффа и вне AC этой задачи; `smoke-select` подтвердил отсутствие
  исполняемого frontend-диффа, адресный смок из AC1 прогнан отдельно вручную.
- Историческую точную причину первого отказа (`39259034538/attempt 1`) задача
  сознательно не объясняет («НЕ сделано» в комментарии автора) — это
  корректно заявлено как граница задачи, не недостаток ревью.
- Ручная dev/GPU-приёмка владельцем не выполнялась — для инфраструктурной
  тестовой правки без продуктового UI это не требуется и не является
  находкой (REVIEWER.md, «Позиция ревьюера»).

## Побочные находки

Побочных находок нет. (`mode=issues` — маршрут публикации новых issue не
задействован, так как отдельных находок вне скоупа не возникло.)

## Вердикт

Зелёный. AC1–AC3 доказаны чтением и собственным исполнением (юнит-тесты и
адресный smoke, оба PASS с подлинными отрицательными путями на
неизменённой реализации), гейты, которые не повторялись, закрыты ссылкой на
зелёный Validate этого SHA, трейлеры и release-ledger корректны, критерии
маршрута §5 пройдены.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/967-modal-observer-retention`, коммит `ccde557dafbc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0b5aca00d202f3c733810c033c438983da3793bb`
  ```
  git log --all --format='%H %T' | grep 0b5aca00d202
  ```
- Тело issue: `1f1f96026202e29d69bfcf82f45f09112be3df77079e932dd114890233ae423d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTAsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjd9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjg4LCJvdXRwdXRfdG9rZW5zIjo0MDI0NiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMDQ2ODcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjozOTM5NTk2LCJjb3N0VXNkRXN0aW1hdGUiOjEuNjA5MzAzMjAwMDAwMDAwNX1dLCJ0dXJucyI6NTUsImR1cmF0aW9uTXMiOjYyMzI1NywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNjE0NTczMjAwMDAwMDAwNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5278 output_tokens=40262 cache_creation_input_tokens=104687 cache_read_input_tokens=3939596 num_turns=55 -->
