# CODE-REVIEW-417-r1

Issue: [#417](https://github.com/Matysh/houseplan-card/issues/417) — «Подтверждение опасного действия всё ещё зависает в двух ветках `render()`: потерянное пространство и языковой гейт».
Трек: `trivial`. Заход: r1. Бюджет циклов лёгкого/короткого трека: 2, израсходовано 0.
Ветка: `issue/417-danger-confirm-render-guards`. Проверяемый SHA: `ad4cce0ddaa372f1c82612919a5541238b1d822f` (сверен `git rev-parse HEAD` непосредственно перед выводом — совпадает).

## Скоуп

Регрессия покрытия после #402: `_confirmDanger()` регистрировал запрос в контроллере в двух ветках корневого `render()`, которые не рисуют `<hp-confirm>` — потерянное активное пространство (`!space → nothing`) и языковой гейт `warm → noChange`. Контракт (тело issue): такой запрос обязан немедленно резолвиться `false`, не оставляя контроллер с висящим состоянием; уже открытый запрос при переходе в ветку потерянного пространства также обязан резолвиться `false`.

AC1/AC2/AC3 — доказательство `smoke`. Файлы по контракту: `src/houseplan-card.ts`, `demo/smoke_danger_confirm_branches.mjs`. Диапазон материала — `git diff origin/dev...HEAD` (3 некоммита D-класса промоушена в счёт не идут по существу, см. ниже).

## Что изменено (по коду, не по описанию автора)

`src/houseplan-card.ts`:
- добавлено поле `_dangerConfirmLocaleGate: LanguageRenderGate = 'ready'`, записывается в `_renderBody()` сразу после вычисления `localeGate`, до всех ранних `return` (:11306-11309) — значение актуально для любой ветки, включая `cold`/фиксированный этаж/обычную;
- добавлен `_dangerConfirmMissingSpace()` (:2160-2168): `false` для онбординга (`!model.length`) и для `fixed.kind === 'pending'/'invalid'` (эти ветки реально рисуют карточку и хостят `hp-confirm` через обёртку `render()`), иначе `!this._spaceModel()` — что точно совпадает с реальной веткой `if (!space) return nothing;` (:11386 в текущем файле);
- `_confirmDanger` (:2166-2172) добавляет два ранних отказа перед регистрацией в контроллере: `_dangerConfirmLocaleGate === 'warm'` и `_dangerConfirmMissingSpace()`;
- в `willUpdate()` (:4168-4171), после `_syncEmptySpaceState()` и до обработки `hass`, добавлен синхронный `if (this._dangerConfirm && this._dangerConfirmMissingSpace()) this._cancelDangerConfirm();` — снимает уже открытый диалог до того, как `render()` в этом же цикле обновления заменит тело на `nothing`.

`_cancelDangerConfirm()` вызывает `HpConfirmController.cancel()` → `resolve(token, false)`, что резолвит промис `false` и обнуляет `_active`/уведомляет `_changed(null)` (`src/danger-confirm.ts:68-72`) — то есть «резолвится `false`» и «контроллер не хранит запрос» из AC1 обеспечены одним и тем же вызовом, а не двумя независимыми путями.

`demo/smoke_danger_confirm_branches.mjs`: расширен тремя блоками, воспроизводящими буквально то, что не покрывал прежний файл (issue прямо называл этот пробел) — реальный вход в `warm` через удержание сетевого запроса немецкого чанка, вход в ветку потерянного пространства через непустую модель с `_spaceModel` → `undefined`, и already-open-запрос, отменяемый синхронно при потере пространства. Регрессионные сценарии из #402 (онбординг, fixed-floor pending/invalid, основная ветка, выживание диалога при смене ветки) сохранены и продолжают проходить.

`scripts/mutation-gate.mjs`: три новых мутанта, каждый снимает один из трёх guard-путей и указывает `demo/smoke_danger_confirm_branches.mjs` как обязанный покраснеть.

## AC — доказательство

| AC | Доказательство | Проверено как |
|---|---|---|
| AC1 (потерянное пространство: новый запрос → `false`, контроллер пуст, `hp-confirm` отсутствует; уже открытый запрос → `false`) | `demo/smoke_danger_confirm_branches.mjs`: `lostSpaceBranchIsActuallyEntered`, `openConfirmCancelsWhenSpaceIsLost`, `lostSpaceRequestRefusesImmediately` (все `true`) + мутанты `danger-confirm-lost-space-request-guard-removed`, `danger-confirm-lost-space-transition-cancel-removed` | Прогнал смок и оба мутанта лично — оба красятся при снятии соответствующего guard, зелены при исходном коде |
| AC2 (языковой гейт `warm`: новый запрос → `false`, контроллер пуст, `render()` сохраняет `noChange`) | `demo/smoke_danger_confirm_branches.mjs`: `warmLanguageGateActuallyEntered`, `warmLanguageGateRefusesImmediately`, `warmLanguageGateKeepsControllerEmpty`, `warmLanguageGateKeepsNoChangeDom` (все `true`) + мутант `danger-confirm-warm-language-guard-removed` | Прогнал смок и мутант лично — мутант красится |
| AC3 (онбординг/fixed-floor pending и invalid/основная ветка по-прежнему показывают ровно один `hp-confirm`; отмена/согласие завершают промис; мутант, убирающий любой из новых guard-сценариев, красит смок) | Тот же файл: `onboardingBranchShowsConfirm`, `onboardingBranchResolves`, `fixedFloorPendingStillShowsConfirm`, `fixedFloorInvalidStillShowsConfirm`, `mainBranchRendersExactlyOneConfirm`, `mainBranchCancelResolvesFalse`, `openConfirmSurvivesBranchChange` — все `true`; регрессия для #402 не сломана | Прогнал `npm test` (1735/1735, не считая 1 skip) и сам смок — 34/34 |

Дисциплина «тест умеет падать» соблюдена не декларативно: я лично прогнал каждый из трёх новых мутантов через `node scripts/mutation-gate.mjs --id=<mutant>` (не через заявление автора) — все три красят `smoke_danger_confirm_branches.mjs` при снятии своего guard и проходят при родном коде.

## Как проверялось — гейты

| Гейт | Кем прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit` | ревьюер | зелёный |
| `npm test` | ревьюер | 1735 passed, 0 failed, 1 skipped, 1736 total — совпадает с отчётом автора |
| `npm run build` + `git status` | ревьюер | сборка воспроизводит закоммиченный `dist/**` побайтово (рабочее дерево чистое после сборки) |
| `npm run bundle:sync` | ревьюер | зелёный, три дерева бандла синхронизированы |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | ревьюер | зелёный, 29 добавленных строк, новых `any` нет |
| `node scripts/check-docs.mjs` | ревьюер | зелёный (diff трогает `src/**`, поэтому обязателен) |
| `node demo/smoke_danger_confirm_branches.mjs` | ревьюер | зелёный, 34/34 — совпадает с отчётом автора |
| `node demo/smoke_fixed_floor.mjs` | ревьюер | зелёный, 14/14 (прямое совпадение по `smoke-select.mjs`) |
| `node demo/smoke_lock_invariant.mjs` | ревьюер | зелёный, 7/7 (прямое совпадение) |
| `node demo/smoke_french_locale.mjs` | ревьюер | зелёный, 5/5 (зарегистрированная связь `languageRenderGate`, #348) |
| `node scripts/mutation-gate.mjs --id=<3 новых мутанта>` | ревьюер, поштучно | все три: «покраснел, как обязан» → «поймано 1 из 1» |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ревьюер | вывод см. ниже; решения по каждой строке приняты |
| `npm run bundle:budget` | ревьюер | initial View 290566 B gzip, запас 9434 B — совпадает с отчётом автора; см. «Риск, не относящийся к находкам» |

### Вывод `smoke-select.mjs` и решения

- **Прямое совпадение (3):** `smoke_danger_confirm_branches`, `smoke_fixed_floor`, `smoke_lock_invariant` — все три прогнаны (см. таблицу выше), все зелёные.
- **Зарегистрированная связь (1):** `smoke_french_locale` (`languageRenderGate`, #348) — прогнан, зелёный. Автор дополнительно прогнал `smoke_german_locale` (не входит в вывод инструмента как отдельная строка, но обоснованно: German — единственный смок, реально доводящий карточку до состояния `warm`); повторно не гонял, доверяю отчёту автора здесь, так как German напрямую совпадает по символу `_dangerConfirmLocaleGate` и уже покрыт содержимым основного смока (`warmGate`-блок использует ту же технику удержания chunk-запроса).
- **Слабая связь (15, все через `_model`):** не прогонял. Модель и её render-семантика диффом не задеты (единственные тронутые строки — новый приватный guard и присвоение локального поля); точные ветви/переходы, которые могли бы пострадать, покрыты `smoke_danger_confirm_branches` напрямую. Полная матрица — предрелизный гейт, не гейт этого ревью.

### Гейты, которые не прогонял, и почему

- `npm run golden:verify` — diff не меняет видимый рендер: `docs/images/screenshots.json` показывает 10/10 `imageSha256` без изменений (только `sourceFingerprint`/`sourceSha256` — хэш исходников, не пикселей), т.е. канонический прогон уже доказал нулевой pixel diff. Собственный прогон golden поверх этого был бы дублированием.
- `npm run invariants -- --config <...>` и model-invariants в целом — diff не трогает геометрию, `layout`, `marker.space`, `open_spans`, толщину стен; затронутые файлы и AC это подтверждают.
- `python -m pytest tests_backend -q` — `custom_components/**/*.py` не тронут.
- performance-профили — не названы в AC, чувствительные к перфу пути не тронуты (guard — синхронная проверка двух булевых веток).
- полный `node scripts/mutation-gate.mjs` (все ~90 мутантов) — дорогой прогон с пересборкой бандла на мутанта; документирован как предрелизный гейт, не гейт ревью. Три релевантных новых мутанта прогнаны поштучно и осознанно.

## Единственный источник числа

Diff не добавляет и не меняет ни одной пользовательски видимой величины (текста, числа, подписи). Единственное новое состояние — булев guard, видимый только как «диалог показан / диалог не показан», без дублирующего представления. `test/single-source-numbers.test.mjs` прошёл в составе `npm test`. Раздел неприменим по существу.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Риск, не относящийся к находкам (не блокирует)

`npm run bundle:budget` показывает запас initial-бандла 9434 Б при пороге предупреждения 15000 Б — это существующий тренд (issue #367), не следствие именно этого диффа: правка добавляет один приватный метод и одно поле, оценочно десятки байт до gzip. Не блокирует #417 и не относится к его AC; упоминаю для полноты гейтов, отдельный issue не завожу — тренд уже отслеживается в #367.

## Проверено чтением, не исполнением

- Порядок вызовов в `willUpdate()`: `_dangerConfirmMissingSpace()` читает `this._model` (геттер, мемоизированный на `_serverCfg`) и `this._fixedFloorState()`/`this._spaceModel()` — оба чистые, без побочных эффектов, поэтому повторный вызов из `_confirmDanger` в другой момент времени безопасен и не дублирует работу с сайд-эффектами.
- `_dangerConfirmLocaleGate` присваивается в `_renderBody()` до всех ранних `return`, поэтому при следующем вызове `_confirmDanger()` (например, из обработчика клика вне цикла рендера) отражает состояние по итогам последнего фактического рендера, а не устаревшее значение по умолчанию `'ready'` — за исключением состояния до первого рендера, когда `_confirmDanger` в любом случае отказывает раньше по `!this._config || !this.hass`.
- `HpConfirmController.cancel()` → `resolve(token, false)` резолвит промис и обнуляет состояние одним вызовом (`src/danger-confirm.ts:59-72`) — значит «промис резолвится `false`» и «контроллер не хранит запрос» из AC1 гарантированы одной и той же операцией, а не двумя независимыми, которые могли бы разойтись.

## Класс изменений и трейлеры

Три коммита в диапазоне, все с `Issue: #417`. `User-Visible: yes` — коммит `e46220f3` («Fix confirmation guards for unrenderable branches») правит оба changelog в этом же коммите (проверено чтением диффа коммита). Два последующих коммита — `User-Visible: no` (уточнение теста, промоушен fingerprint скриншотов) корректно помечены как непользовательские.

`dist/**` и `custom_components/houseplan/frontend/**` (класс D) изменены — легитимно, это промоушен пересобранного бандла в том же PR, обязательный по правилу «сборка отражает исходники»; воспроизвёл его независимой сборкой и она побайтово совпала с закоммиченным.

## Вердикт

Все три AC доказаны автотестом, и я лично убедился, что каждый новый guard способен провалить тест (три мутанта поймано 1 из 1 каждый). Регрессия #402 не сломана. Находок нет.

**Зелёный.**

---

### Материал раунда

- Ветка: `issue/417-danger-confirm-render-guards`
- SHA материала (сверен `git rev-parse HEAD` перед выводом): `ad4cce0ddaa372f1c82612919a5541238b1d822f`
- Диапазон: `git diff origin/dev...HEAD` (`origin/dev` на момент ревью = состояние после релиза v1.70.0)
- Первый раунд — раздела «Унаследовано из r0» и «Закрытие предыдущего раунда» не требуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/417-danger-confirm-render-guards`, коммит `ad4cce0ddaa3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `bd84e7215b27fd327da21b1db018c370667417c0`
  ```
  git log --all --format='%H %T' | grep bd84e7215b27
  ```
