# CODE-REVIEW-434-r1

- Issue: #434 — «Полиш аудита v1.71.0-beta.1»
- Этап: код-ревью (PROCESS.md §2.7), полный трек
- Заход: r1 · блокирующих циклов израсходовано 0/4
- SHA материала: `dbda64e89d6b76cabfe57c21f281cb6d5132c257` (HEAD в момент разбора; сверено `git rev-parse HEAD` непосредственно перед выводом)
- Диапазон: `origin/dev...HEAD` (5 коммитов: `8a75c53e` спека, `f383d8fd`/`4190db54` документы спек-ревью r1/r2, `cba13621` реализация, `dbda64e8` довесок-мутант)
- Ветка ребейзнута конвейером на 1 коммит dev (`a71531ba → dbda64e8`) — разбор проведён полностью, не по дельте, как и требуется для r1.

## Скоуп

ТЗ закрывает девять подтверждённых разрывов аудита v1.71.0-beta.1: физический
учёт decor-blobs независимо от sidecar (AC1), recovery orphan-загрузки с честным
`reused` (AC2), точное явное удаление (AC3), недостающий негативный тест
sidecar-без-blob (AC4), capability guard в `houseplan-space-card` + revision-scoped
resolve cache (AC5, AC6), честный «текущий» locale gate для danger confirmation
(AC7), негативный witness Area snapshot cleanup (AC8), bounded smoke timeouts
(AC9), отзыв support-токена из непринятого превью (AC10). Все относятся к Core
user jobs `docs/SCOPE.md` (надёжность View/редактора, честность данных, CI-гигиена
для Contributor); продуктовой рамки, требующей отдельного вопроса владельцу, не
нашёл.

## Как проверялось

### Дешёвые гейты (прогнаны лично, SHA выше)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | 0 ошибок |
| Unit (JS) | `npm test` | 1813 тестов, 1812 pass, 1 skipped, 0 fail |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (60 добавленных строк в 5 файлах) |
| Build + 3 копии бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && npm run bundle:sync` | совпадают байт-в-байт; `git status` после ребилда чист |
| check-docs (diff трогает `src/**`) | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| backend pure | `python3 -m pytest tests_backend/test_decor_assets.py -q` | 52 passed |
| model-invariants | не запускал | diff не трогает геометрию (rooms/walls/`layout`/`marker.space`/`open_spans`) — не применимо |

### Отбор смоков (`node scripts/smoke-select.mjs --base origin/dev --head HEAD`)

Матрица 216 смоков, «широкий» символ — порог >43 смоков. Вывод инструмента:
21 «прямое совпадение», 35 «слабая связь», 1 «зарегистрированная связь»
(`smoke_french_locale` ← `languageRenderGate`, не запускал — French locale
сценарий не задет этой задачей, связь регистрируется как «эта функция широко
переиспользуется», не как прямое следствие правки).

Прогнал целенаправленно:

- `demo/smoke_danger_confirm_branches.mjs` — прямое совпадение, единственный
  файл, названный в AC7 и изменённый в диффе. **OK**, все 38 полей `true`.
- `demo/smoke_space_card_decor_capability.mjs` (новый файл, AC5) — **OK**,
  4/4 поля `true`.
- `demo/smoke_support_feedback.mjs` (новый файл, AC10) — **OK**, 29/29 полей `true`.

Остальные 20 «прямых» и 35 «слабых» совпадений — реакция на широко
переиспользуемые символы (`_cfgRev`, `_snap`, `_config`, `_confirmDanger`),
не специфичные для этой задачи логике; полный прогон всей матрицы — предрелизный
гейт (PROCESS §8), не гейт ревью. Golden не запускал — спека прямо говорит
«Golden не требуется» (визуальный кадр не меняется), проверено чтением: diff не
трогает ни один шаблон рендера кроме `_renderRoot`/`_renderDangerConfirm`,
геометрию которых golden не покрывает по замыслу задачи.

### Backend HA harness — НЕ прогонял (честно, гейт пропущен намеренно)

`tests_backend/test_ha_websocket.py` содержит новые/изменённые тесты для AC2 и
AC3 (`test_decor_asset_upload_deduplicates_and_rejects_mime_spoofing` расширен,
`test_decor_asset_delete_removes_exact_orphans_only` новый). Окружение этого
ревью — Python 3.12, `pytest-homeassistant-custom-component==0.13.357` требует
Python ≥3.14 (проверил: `pip install` дал `ResolutionImpossible`/no matching
distribution), `.venv-backend` отсутствует. Это ограничение среды ревью, не
находка по коду (AGENTS.md: «только облачные агенты держат харнесс»).
**AC2 и AC3 доказаны чтением, не исполнением** — см. ниже.

### Мутационные свидетели — прогнаны выборочно (`--changed` затронул 109/380, полный прогон непропорционален; проверил вручную 8 новых/изменённых записей, относящихся к этой задаче)

`node scripts/mutation-gate.mjs --changed --check` — все 109 применимых
патчей легли на текущий код (`ok` по каждому, 0 `FAIL`). Живой прогон (патч →
пересборка → гард) сделал для мутантов этой задачи:

| Мутант / AC | Гард | Результат живого прогона |
|---|---|---|
| `decor-physical-inventory-follows-sidecars` (AC1) | `pytest -k physical_inventory` | применил патч руками → **тест покраснел** (`assert [] == [...]`) |
| `decor-catalog-accepts-sidecar-without-blob` (AC4) | `pytest -k valid_shaped_sidecar_without_blob` | применил патч руками → **тест покраснел** (`row is not None`) |
| `danger-confirm-uses-last-rendered-language-gate` (AC7) | `smoke_danger_confirm_branches` | применил патч руками → **смок покраснел** на `warmToReadyAllowsBeforeRender` |
| `danger-confirm-warm-transition-cancel-removed` (AC7) | `smoke_danger_confirm_branches` | применил патч руками → **смок покраснел** на 3 полях (`readyToWarmCancelsOpenConfirmation`, `warmLanguageGateKeepsControllerEmpty`, `warmLanguageGateRemovesDecisionSurface`) |
| `area-cleanup-keeps-candidate-outside-current-snapshot` (AC8) | `node --test -k "absent from the current snapshot"` | применил патч руками → **тест покраснел** (`true !== false`) |
| `support-invalid-response-leaks-issued-token` (AC10) | `smoke_support_feedback` | применил патч руками → **смок покраснел** на `invalidPreviewTokenIsDiscardedExactlyOnce` |

После каждого прогона дерево восстановлено (`git status` чист, `cp` бэкапа
исходника обратно + ребилд). Не прогонял живьём: `decor-orphan-repair-runs-after-quota`,
`decor-orphan-repair-claims-reuse`, `decor-delete-skips-orphan-blobs` — их гард
использует `tests_backend/test_ha_websocket.py`, недоступный в этой среде
(см. выше); патчи прошли `--check` (якорь находится ровно один раз в текущем
коде), сама логика разобрана чтением ниже.

## Разбор по AC

**AC1 — physical inventory.** `physical_asset_blobs()`/`physical_asset_usage()`
(`decor_assets.py`) считают файлы через `stat(follow_symlinks=False)` +
`S_ISREG` + `suffix in ASSET_EXTENSIONS` + `ASSET_ID_RE.fullmatch(stem)` —
директории, symlink, `.json`, неизвестные расширения и prefix-совпадения не
входят; новый тест `test_physical_inventory_counts_exact_promoted_blobs_not_sidecars`
проверяет все эти случаи одним фикстуром. **Доказано**: pytest прогнан, мутация
красит.

**AC2 — upload recovery.** `http_api.py`: recovery-ветка (`if blob.exists(): ...`)
идёт строго ДО вызова `physical_asset_usage()`/проверки квоты — repair не требует
свободного слота, как того требует контракт. `existing = read_asset(...)` (valid
sidecar + verified blob) возвращает `reused:true` без изменений; orphan (blob без
принимаемого catalog row) хешируется, атомарно создаёт sidecar через
`tempfile.mkstemp` + `os.replace`, возвращает `reused:false`; digest mismatch
кидает `invalid_image` до любой записи. Тест `test_decor_asset_upload_deduplicates_and_rejects_mime_spoofing`
покрывает repair-при-полной-квоте (`monkeypatch MAX_DECOR_ASSETS_COUNT=1`) и
digest-mismatch (проверяет, что повреждённый blob и отсутствие sidecar
остаются нетронутыми, `rejected.status==507`). **Проверено чтением, не
исполнением** (харнесс недоступен); тест и код логически согласованы построчно.

**AC3 — explicit delete.** `websocket_api.py::ws_assets_delete._delete()`
перебирает `ASSET_EXTENSIONS` по точному `<aid><ext>`, плюс sidecar; `in_use`
проверяется ДО вызова `_delete()` под `write_lock+upload_lock`, так что ничего
не удаляется при отказе. Новый тест `test_decor_asset_delete_removes_exact_orphans_only`
кладёт orphan `.png`+`.svg`+битый `.json`, соседний `.gif` (неизвестное
расширение), `aid+"0".png` (prefix) и директорию `aid.webp` — все три «не
трогать» кейса проверяются явно. **Проверено чтением, не исполнением** (харнесс
недоступен); код и тест согласованы построчно, включая заявленный `removed`.

**AC4 — regression sidecar-без-blob.** Продуктовый код не менялся (защита
`blob.is_file()` уже была в `_read_catalog_row` на `dev`) — задача добавляла
только пропущенный отрицательный тест, ровно как описано в причине #4. **Доказано**:
pytest прогнан, мутация (удаление `or not blob.is_file()`) красит новый тест.

**AC5 — capability guard.** `config-store.ts`: `decorAssetsApi` — только точное
`=== 1`, localStorage-seed всегда `null`; unit-тесты `config-store.test.mjs`
проверяют апгрейд/даунгрейд/`localStorage`. `space-card.ts`: resolve вызывается
только при `snap.decorAssetsApi === DECOR_ASSETS_API_VERSION`; при отсутствии —
`_decorAssets` безусловно очищается, resolve не вызывается — подтверждено живым
смоком (`oldBackendSkippedResolve`, `downgradeRevokesWithoutResolve`). **Доказано**
смоком + unit.

Отдельно проверил утверждение «принимает capability-only изменение snapshot
даже при неизменных config/layout/vLights fingerprints»
(`decorAssetsCapabilityChanged` в OR-условии замены `this._snap`, space-card.ts:732)
— см. находку Low-1 ниже: код корректен, но заявленный сценарий не
верифицирован тем инструментом, который на него ссылается.

**AC6 — resolve cache.** `resolveDecorAssets()`: `key = JSON.stringify([configEpoch, unique])`,
кэш пишется только после успешного цикла (до `resolveCache.set` включая throw —
исключение прерывает функцию раньше). Три новых/изменённых unit-теста
(`decor-assets.test.mjs`) прогнаны в `npm test`, логика проверена чтением —
мутация «убрать epoch из key» ловится тестом «resolve cache is scoped by
authoritative config epoch» (прочитан, не мутировал вручную — тривиально
следует из кода). **Доказано** unit-тестами.

**AC7 — danger confirmation.** `_dangerConfirmLocaleGate` стал геттером
(никогда не кэшируется), `_confirmDanger` проверяет его на каждый вызов;
`willUpdate` отменяет открытый confirm при переходе в `warm` СИНХРОННО до
`render()`; `render()`/`_renderRoot()` используют один и тот же call site
шаблона, чтобы вложенный `noChange` для тела уживался с независимым удалением
`hp-confirm`. Смок прогнан живьём (зелёный, 38/38), и я вручную применил и
откатил обе новые мутации реестра — оба раза целевые поля красятся именно так,
как заявлено в `because`. **Доказано** смоком + двумя живыми мутациями.

**AC8 — Area snapshot negative witness.** Продуктовый код не менялся (защита
`snapshotBindings.has(binding)` уже была на `dev`) — только новый unit-тест.
**Доказано**: тест прогнан, мутация красит именно этот тест.

**AC9 — bounded smoke execution.** `validate.yml`: job `smoke` получил
`timeout-minutes: 20`; каждый файл — `timeout --kill-after=10s 180s node "$f"`,
статус 124 печатает отдельную диагностическую строку, `continue` внутри цикла
файлов не встречается — падение одного файла не останавливает шард (существующий
код, не тронут). `smoke_danger_confirm_branches.mjs` обернул оба
German-ожидания (`germanStarted`, `germanCompleted`) в `Promise.race` с 1000 мс.
Новый `test/smoke-exception-guard.test.mjs` проверяет все три границы текстовым
соответствием YAML — прогнан, зелёный. Живой смок подтверждает, что German-путь
укладывается в границы (никакого зависания на реальном прогоне). **Доказано**
текстовым контрактным тестом + живым прогоном смока; сам workflow на GitHub
Actions не выполнялся (не гейт ревью, а CI-инфраструктура).

**AC10 — support token cleanup.** `_buildSupportPreview()`: `issuedToken`
фиксируется сразу после парсинга ответа (валидация формы `^[0-9a-f]{48}$`), ДО
общей проверки hash/format/version/size/spaces/expires/text, которая кидает
`support_rejected`; `catch`-блок discard'ит `issuedToken`, если он не был
обнулён успешным путём. Malformed/отсутствующий токен никогда не попадает в
`issuedToken`. Живой смок зелёный (29/29), живая мутация (снятие discard в
catch) красит ровно `invalidPreviewTokenIsDiscardedExactlyOnce`. **Доказано**
смоком + живой мутацией.

**AC11 — совместимость/документация.** Grep диффа не находит изменений схемы,
версии API (`DECOR_ASSETS_API_VERSION` остался `1`), i18n-ключей или визуальных
шаблонов вне `_renderRoot`/`_renderDangerConfirm` (сам рендер тех же узлов, что и
раньше, просто перегруппированный). `docs/ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
`SUPPORT-PRIVACY.md`, `TESTING.md`, оба `CHANGELOG*` изменены в одном коммите
`cba13621` с трейлерами `Issue: #434` / `User-Visible: yes`. **Проверено
чтением**: diff review + `check-docs` зелёный.

**AC12 — гейты.** Typecheck/unit/build/bundle-sync/no-new-any/check-docs —
зелёные (таблица выше). Backend pure — зелёный. Backend HA — не прогонял
(ограничение среды, см. выше, отражено честно). Отобранные смоки — зелёные.
Мутационные свидетели — 6/9 новых прогнаны живьём и красят корректно, 3/9
(HA-зависимые) проверены `--check` + чтением. Golden/full performance —
предрелизные, не гейт ревью (спека сама это утверждает).

## Находки

### Low-1 — `decorAssetsCapabilityChanged` в `space-card.ts:711-732` не влияет на
наблюдаемое поведение и не верифицируется смоком, на который ссылается спека

`this._snap.decorAssetsApi` пишется в двух местах (`space-card.ts:733` и `:736-737`
через частичное обновление) и читается **только** в вычислении самого
`decorAssetsCapabilityChanged` (`:711-712`) — больше нигде в проекте
(`grep -n "decorAssetsApi" src/*.ts` даёт ровно 6 строк, все либо запись, либо
сравнение с только что полученным `snap`, а не с `this._snap`). Реальная
семантика AC5 — вызов/невызов `resolve` и очистка `_decorAssets` — читает
**свежий** `snap.decorAssetsApi` напрямую (`:713`, `:740`), а не `this._snap`.
Поэтому замена `this._snap` целиком против частичного обновления `rev`/`layoutRev`
не производит никакой разницы, которую можно было бы пронаблюдать.

**Как проверил.** Убрал `|| decorAssetsCapabilityChanged` из условия на
`:732`, пересобрал бандл, прогнал `smoke_space_card_decor_capability.mjs`
(остался зелёным, 4/4) и отдельным зондом (`page.evaluate`, три `_load()`
подряд: null→1→null) убедился, что `_snap.decorAssetsApi` меняется
`null → 1 → null` **даже без строки** — потому что `virtualLightsChanged`
в этой фикстуре (и, по прослеживанию кода, в любом реальном сценарии, где
`fetchFresh()` вообще выполняется — `cache` в `config-store.ts` всегда `null`
на входе в `fetchFresh`, значит `virtualLightSnapshot()` каждый раз строит
новый объект) уже безусловно `true` ровно тогда, когда снимок вообще меняется.

`test/space-card-audit-lows.test.mjs` проверяет присутствие строки
`decorAssetsCapabilityChanged` в исходнике текстовым `assert.match` — это ловит
буквальное удаление термина, но не поведенческую регрессию, и не то же самое,
что «тест умеет падать» в смысле PROCESS §2.7 (сам мутационный реестр не
содержит записи для этой строки).

**Не блокирует.** Строка не создаёт неверного поведения (она безвредно
избыточна), реальный контракт AC5 (запрет resolve на старом backend, очистка
map при даунгрейде, кэш по epoch) доказан отдельно и надёжно. Снимаю как Low с
запиской: если авторы захотят вычистить, это чистое упрощение (убрать термин
из OR и из текстового теста, ничего не потеряв); можно и оставить как
задел на случай, если `_snap.decorAssetsApi` найдёт читателя в будущем.

### Low-2 — `_dangerConfirmLocaleGate` геттер может вызвать `languageRenderGate()`
дважды за один цикл обновления, пока открыт danger confirm

`languageRenderGate()` (`src/i18n/language-runtime.ts:105`) не чистая функция:
мутирует `pendingHosts`/`committedHosts`, дёргает `host.setAttribute`, и — что
существеннее — при `state === 'pending'` безусловно подписывает новый
`.then()` на `runtime.ensure(code)` при **каждом** вызове, не только при первом
вхождении в pending. `willUpdate()` (`houseplan-card.ts:4192-4194`) читает
геттер, когда `this._dangerConfirm` истинен, и `_renderBody()` (`:11239`) читает
его снова безусловно — при открытом danger confirm это два вызова за один
рендер-цикл вместо одного до этой правки (когда значение кэшировалось полем).

**Не блокирует.** Оба вызова происходят синхронно в одном тике (между
`willUpdate` и `render()` нет await), поэтому `runtime.state(code)` не может
измениться между ними — итоговое значение геттера согласовано на всём проходе.
Лишняя подписка `.then()` на уже существующий (мемоизированный) промис
`runtime.ensure()` добавляет не более одного лишнего `requestUpdate()` при
разрешении — Lit схлопывает такие вызовы. Открытый danger confirm — не самое
частое состояние карточки. Снимаю как Low без правки.

## Унаследовано / повторная проверка

Не применимо — это первый заход код-ревью (r1) по этому issue; разделы
«Закрытие r(N-1)» и «Унаследовано из r(N-1)» не ведутся согласно PROCESS §2.10.
(Два документа `SPEC-REVIEW-434-r1.md`/`-r2.md` в диффе относятся к
предыдущему этапу — ревью ТЗ, а не коду; их вердикт не переоткрывал.)

## Чего не проверял и почему

- **`tests_backend/test_ha_websocket.py` (полный HA-харнесс)** — среда ревью
  Python 3.12, пин `pytest-homeassistant-custom-component==0.13.357` требует
  ≥3.14, `.venv-backend` недоступен. AC2/AC3 доказаны чтением построчного
  соответствия теста и кода (см. разбор выше), не исполнением.
- **Полный `npm run golden:verify`** — спека прямо утверждает «Golden не
  требуется» (нулевая визуальная дельта в устойчивых состояниях); чтением
  подтвердил, что изменённые рендер-точки (`_renderRoot`) рисуют тот же набор
  DOM-узлов, что и раньше, в другой обёртке.
- **`npm run golden:capture`/`performance_smoke`/полный набор `demo/smoke_*.mjs` (216 файлов)**
  — предрелизный гейт (PROCESS §8), непропорционален объёму этой задачи; выбрал
  3 смока, прямо названных в AC и физически изменённых в диффе.
- **Полный `node scripts/mutation-gate.mjs`(без `--changed`) — 380 мутантов** —
  предрелизный гейт по определению самого скрипта («прогон дорогой... его
  место — перед стабильным релизом»); ограничился `--changed --check` (все 109
  затронутых патчей применимы) плюс живым прогоном 6 из 9 новых/изменённых
  записей, относящихся именно к этой задаче.
- **`node scripts/model-invariants.mjs`** — diff не касается геометрии
  (rooms/walls/layout/marker.space/open_spans), гейт неприменим.
- **French locale smoke (`smoke_french_locale.mjs`)** — «зарегистрированная
  связь» через `languageRenderGate`, но сценарий (network/lazy German chunk)
  не задет этой задачей; решил не гонять.
- **35 «слабых» совпадений smoke-select** — общие символы (`_cfgRev`, `_config`
  и т.п.), не специфичные для этой правки; не гонял, полагаясь на unit/typecheck
  как более узкое доказательство отсутствия регрессии в этих поверхностях.

## Итог

High: 0. Medium: 0. Low: 2, обе сняты с запиской (см. выше), правки не требуют.
Все 12 AC доказаны — либо зелёным тестом/смоком с подтверждённой (в 8 из 10
защитных случаев — лично прогнанной) способностью падать, либо честной пометкой
«проверено чтением, не исполнением» там, где харнесс недоступен в среде ревью.
Документация, changelog и трейлеры в порядке. Вердикт: **зелёный**.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/434-v171-polish-audit`, коммит `a71531ba30d2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `840317519dfa1ae59a2ecf7317ce53bd819c4504`
  ```
  git log --all --format='%H %T' | grep 840317519dfa
  ```
- ТЗ `docs/specs/434-v171-polish-audit.md`, блоб `e235fcef2bcd817c39c0c5a9134fd2ec8f6eb2f1`
  ```
  git log --all --find-object=e235fcef2bcd817c39c0c5a9134fd2ec8f6eb2f1 -- docs/specs/434-v171-polish-audit.md
  ```
