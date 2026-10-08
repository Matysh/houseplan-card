# CODE-REVIEW-824-r1

Issue: #824 · Этап: code · Трек: ask · Заход: r1 · Материал: `f3fc09274fabb43ff340a239d49782d35be7506d`
(`git log --oneline origin/dev..HEAD`: 3fb6f8aa, d2ee576a, 9177e133, f3fc0927)

## Скоуп

ТЗ #824 (принято спек-ревью зелёным r1, High 0 / Medium 0) закрывает три остатка
после beta.8 (F37/F38/F49): устаревший план у `space-card` после detach/attach,
необработанная ошибка при long-resume полной карточки без готового `hass`, и
показ новой геометрии со старым device-snapshot на таймауте paint-barrier.
Контракт поведения — пп. 1–6 §5 тела issue; AC1–AC6 — §7.

Изменены: `src/card-read-lifecycle.ts` (новый), `src/config-reload-authority.ts`
(экспорт трёх внутренних хелперов, без смены логики), `src/houseplan-card.ts`,
`src/space-card.ts`, `src/visual-continuity.ts`; юнит-тесты
`test/card-read-lifecycle.test.mjs` (новый), `test/visual-continuity.test.mjs`;
новый браузерный смок `demo/smoke_view_recovery.mjs` (357 строк); правки трёх
существующих смоков, чтобы их фикстуры шли через реальный attach, а не через
посев приватных `_snap`/`_loadedOnce`; `scripts/mutation-registry.mjs` (+8
записей); docs (`ARCHITECTURE.md`, `WARM-REMOUNT.md` §5.1, `DEVELOPMENT.md`,
`STATUS.md`, `mutation-browser-guards.md`, оба CHANGELOG).

**Риск по изменённым участкам.** Промпт пометил хунки `config-reload-authority.ts`
классом «migration» (строки 47, 71, 122, 159, 207 и ещё 14). Это ложное
срабатывание эвристики по ключевым словам («reload», «authority»): в диффе нет
ни схемы, ни пользовательских файлов, ни переноса данных — §6 ТЗ прямо
фиксирует «нет миграции», и чтение диффа (см. ниже) подтверждает: это
переименование/экспорт трёх уже существующих приватных функций
(`sameContext`→`sameReloadContext`, `claimCurrent`→`configReloadClaimCurrent`,
плюс новый `beginConfigReload`) без изменения их тел. Реальное содержание этого
участка — общая read-authority, используемая `_loadFromServer`, — покрыто
AC2 (отложенное намерение/коалесинг) и AC4 (устаревший ответ не берёт write
authority). Остальные 14 хунков — `houseplan-card.ts`/`space-card.ts`
(AC1–AC5), `visual-continuity.ts` (AC3), `card-read-lifecycle.ts` (AC1/AC2/AC4),
тесты и демо (AC6) — каждый с прямой строкой в контракте или таблице AC.
Класс не меняет вывод: `route: fix` остаётся в силе на треке `ask`.

## Как проверялось

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | PASS (дешёвый гейт подтверждён на этом SHA) | Validate [run 37759777280](https://github.com/Matysh/houseplan-card/actions/runs/37759777280), job «Фронтенд: типы, юниты, мутанты, синхрон бандла» — success |
| Браузерные смоки, все 3 шарда (включая новый `smoke_view_recovery`) | PASS, 0 FAIL | тот же run; лог шарда 3/3: `ok   smoke_view_recovery`; `fail=0` по всем трём шардам — независимо прочитан мной из логов job’ов 113254773897/970/774024 |
| `npm run golden:verify` (метка `ci:golden` на issue подтверждена) | PASS | тот же run, job «Golden-кадры против принятых эталонов» — success |
| `performance_smoke` | PASS | тот же run, job «Перф-смок» — success |
| `pytest tests_backend` / HA-harness | не прогонялся, не нужен | диффа в `custom_components/**` нет; job «Бэкенд» в этом run skipped закономерно |
| `npm run invariants` (геометрия) | не нужен | диффа в модели геометрии нет (список файлов выше) |
| `node scripts/mutation-gate.mjs --check` | PASS, 4 старых предупреждения, все 8 новых записей `#824` — `ok` | прогнал сам |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений | прогнал сам |
| `node --test test/card-read-lifecycle.test.mjs` | 6/6 PASS на исходнике | прогнано субагентом независимо (сборка `tsconfig.test.json` + `fix-test-build.mjs`) |
| `node --test test/visual-continuity.test.mjs` | 11/11 PASS на исходнике; **RED** на мутанте `continuity-timeout-blesses-candidate` (`AssertionError: 'steady' !== 'holding'`), снова **GREEN** после отката | прогнано тем же субагентом, патч применён и откачен, `git status` чист |
| Независимое чтение `demo/smoke_view_recovery.mjs` против стиля существующих смоков | реальный Chromium, реальные `connectedCallback/disconnectedCallback`, по assert на каждый AC1–AC4, не self-fulfilling | отдельный субагент, построчно сверено с продуктовым кодом |
| Чтение diff по всем 5 изменённым src-файлам и обеим тест-таблицам | выполнено мной построчно | этот документ |

Дешёвые гейты не перегонялись локально — зелёный Validate на точном SHA материала
уже их покрывает (#343); я прочитал логи job’ов этого run, а не поверил только
статусу «success» названия workflow.

## Находки

Блокирующих находок нет.

**Low (снято ревьюером, без возврата автору).** `demo/smoke_view_recovery.mjs`
патчит глобальный `Date.now` трижды (строки ~86–88, 103–104, 111–112) без
`try/finally` вокруг сценария: если assert внутри патченного блока бросит
раньше восстановления, `Date.now` останется подменённым для последующих
сценариев того же запуска страницы. Риск низкий — восстановление стоит сразу
после единственного замера в каждом из трёх мест, — но это единственное
отступление от общей аккуратности файла. Не открывает цикл: не затрагивает ни
один AC и не меняет наблюдаемое поведение продукта.

## Что проверено и корректно

- **AC1** (revalidation после detach/attach). `space-card.connectedCallback`
  безусловно ставит `_attachReload = true` и форсирует `_load(true)`, если
  `hass.callWS` уже доступен; `updated()` подхватывает то же через
  `(this._attachReload || !this._loadedOnce)` для случая, когда `hass` приходит
  позже. Старый гейт `(!this._snap || !this._loadedOnce)` (F37 — не
  перепроверял конфиг при уже загруженном снимке) удалён целиком. Браузерный
  смок `attachDoesRealServerRead`/`fresh` (4→3 комнаты, `rooms()===3`) и
  мутант `space-reattach-skips-authoritative-read` подтверждают это
  исполнением, не чтением.
- **AC2** (поздний `hass`). `_loadFromServer`/`_load` в обеих карточках
  начинаются с `if (!this.isConnected || typeof this.hass?.callWS !== 'function')`
  — полная карточка через `this._read.defer()` (намерение сохраняется, не
  запрос), static card — просто не начинает попытку (её собственный
  `_attachReload` остаётся true до следующего `updated()`). `willUpdate`
  полной карточки (`if (this._read.pending) void this._loadFromServer();`)
  подхватывает отложенное намерение на первом же Lit-апдейте с пригодным HA.
  Юнит `card-read-lifecycle.test.mjs` и мутант `full-resume-forgets-late-hass`
  закрывают «0 вызовов/0 unhandled» и «один coalesced load» по отдельности.
- **AC3** (таймаут paint-barrier). Ключевое изменение — `commitAfterPaint`
  при `!outcome.ready` переводит `_hasCompleteFrame`-состояние в `holding`
  (было `steady`), не трогая `_frameFingerprint`, и выставляет
  `_paintTimedOut = true`; `canAttemptPaint` разрешает повтор только когда
  `externalUpdate && paintTimedOut && assetsReady` — без своего RAF/таймера.
  В карточках убран блок, который раньше на неудачном commit обнулял
  `_candidateDeviceSnapshot`/`_stagedDeviceSnapshotToken` (это и была причина
  F38: `selectRenderDeviceSnapshot(visible-old, null, false, geometry-new)`
  откатывался на `visible-old`). Теперь staged-кандидат, уже привязанный к
  новой геометрии (`_stagedToken === token`), не трогается — `selectRenderDeviceSnapshot`
  (сам файл `#813` не менялся) продолжает отдавать его по первому же условию
  `preferred.geometry === geometry`. Юнит-тест `#824 a timeout preserves
  identity…` и его мутация (RED→GREEN, см. таблицу гейтов) подтверждают
  состояние и отсутствие retry-петли; браузерный `demo/smoke_view_recovery.mjs`
  добавляет живую проверку CSS-поворота дверного полотна
  (`noNewDoorWithOldSnapshot: angles.length===0`) — настоящий DOM-oracle, не
  только внутреннее поле.
- **AC4** (устаревшие ответы). И полная карточка (`configReloadClaimCurrent`
  поверх уже существующего `ConfigReloadAuthority`), и static card
  (`_read.isCurrent(loadClaim)` + повторный `observe()` на каждой await-точке,
  что ловит смену route/space без переприсвоения `hass`) проверяют актуальность
  перед каждым побочным эффектом (`_adoptAuthoritative`, trail-tail, запись
  `_decorAssets`). `full-read-ignores-lifecycle-owner` /
  `space-read-ignores-lifecycle-owner` — пара мутантов на каждую карточку.
- **AC5** (регрессия существующего поведения). Полный матрица смоков + golden
  зелёные на материале (см. таблицу); три адаптированные фикстуры
  (`smoke_device_preview_parity`, `smoke_value_face_source`,
  `smoke_optimize_coordinate_canonicalization`) теперь публикуют конфиг через
  `__hpTest.setServerConfig`/отдельный «холодный» элемент вместо прямой записи
  `_snap`/`_serverCfg`, что и требовалось — старый способ обходил новый
  attach-revalidation и гонял бы гонку с параллельным авто-intake.
- **AC6** (доказательства). Таблица в хендоффе автора (AC → команда → чем
  краснеет) заполнена по каждой строке, пустых столбцов нет. Независимо
  проверено: все 8 новых записей `mutation-registry.mjs` (6 browser-only +
  2 cheap controller) статически валидны (`mutation-gate --check`), и одна из
  cheap controller записей реально ловит регресс (RED при применении, GREEN
  после отката — см. таблицу). Прогон самих мутантов в разработке не требуется
  (#709) — ни автором, ни мной.
- Трейлеры: все 4 коммита несут `Issue: #824`; `User-Visible: yes` ровно на
  двух коммитах (`3fb6f8aa`, `f3fc0927`), и оба правят `CHANGELOG.md` и
  `CHANGELOG.ru.md` в себе же. Итоговый текст в обоих файлах — один и тот же
  набор фактов на двух языках, чисел с «двойным источником» (§8) в этих
  записях нет. `process-gate` подтверждает 0 предупреждений.
- Рефакторинг `config-reload-authority.ts` — чистое переименование под экспорт
  (см. «Риск по изменённым участкам» выше), тела функций не менялись.

## Чего не проверял

- `pytest tests_backend` и HA-harness — не нужен: диф не касается
  `custom_components/**` (чисто TS/docs/demo/test).
- `npm run invariants` — не нужен: геометрическая модель не менялась.
- Полный предрелизный набор (release-контракты, HACS, hassfest, geometry
  parity) — за пределами гейта код-ревью (§8), эти job’ы в Validate-run
  закономерно skipped (нет изменений, которые их бы включили).
- Сами 6 browser-only мутантов не применял и не откатывал руками (это не
  обязанность ревьюера — #709, ловит их ночной прогон реестра); проверил
  только их статическую регистрацию и что `because` называет конкретный AC.
- Свежесть скриншотов документации — не гейт задачи (#697).
- Ручное визуальное тестирование в браузере (кликанье по интерфейсу) не
  проводилось; доказательство AC — исполненные смоки/юниты на реальном
  Chromium (через Validate-run и прямое чтение логов), а не ручной просмотр.

## Вердикт

Зелёный. High: 0, Medium: 0 (единственная Low снята без возврата автору).
Все 6 пунктов контракта поведения и AC1–AC6 проверены исполнением там, где
того требовал защитный характер AC, или чтением с отметкой «проверено чтением»
там, где это был чистый рефакторинг экспорта. Route: fix.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/824-view-remount-continuity`, коммит `f3fc09274fab` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a613aa83b17ba1c53250f77e7a373cafb7a7a113`
  ```
  git log --all --format='%H %T' | grep a613aa83b17b
  ```
- Тело issue: `5c4f5ef7aeec9c1585d146c9f508a7e4aa46c09896bb0bd6f005bf91cd6a6479`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4309 output_tokens=45545 cache_creation_input_tokens=219887 cache_read_input_tokens=5916440 num_turns=56 -->
