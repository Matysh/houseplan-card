# CODE-REVIEW-543-r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

Материал: `a1fac44d72a4160f1f5a3dc59b637aa662af3764` (ветка `issue/543-config-reload-ownership`),
рабочая копия проверена ровно на этом SHA, `git fetch`/`checkout` не выполнялись.
Это первый код-ревью раунд задачи (ранее прошли только два SPEC-REVIEW раунда,
оба зелёные/жёлтые на этапе ТЗ) — разбор полный, деление на дельту не
применяется (PROCESS.md §2.9 касается только повторных code-review раундов).

## Скоуп

Диапазон `origin/dev..HEAD` — один коммит. Правит гонку конкурентных
`_reloadConfigOnly()`/`houseplan_config_updated`: поздний ответ с более старой
конфигурацией (в т.ч. застрявший на `ContentSigner.prepareImage()`) больше не
откатывает уже принятую более новую конфигурацию, ревизию, View, virtual-light
snapshot и localStorage-кэш. Контракт К1–К9 из ТЗ реализован новым модулем
`src/config-reload-authority.ts` (`ConfigReloadAuthority`, `reloadConfigOnly`)
плюс тремя `isCurrent()`-проверками в общей `adoptAuthoritativeGated()`
(`src/config-adoption.ts`). SCOPE J1/J6 (актуальность состояния дома,
согласованность нескольких клиентов) — единственная затронутая строка, задача
внутри неё.

Файлы: `src/config-reload-authority.ts` (новый, 281 строка),
`src/config-adoption.ts` (+15), `src/houseplan-card.ts` (+56/-40 — замена тела
`_reloadConfigOnly` на вызов нового модуля, проводка `observeContext`/
`invalidateLifecycle` в `connectedCallback`/`disconnectedCallback`/
`willUpdate`/`_leaveCardRoute`), тесты, `scripts/mutation-gate.mjs` (+1 мутант),
`scripts/bundle-budget.mjs` (пересчёт потолка), оба changelog,
`docs/ARCHITECTURE.md`. Геометрия/layout/marker/open_spans не тронуты —
`npm run invariants` не требуется. Видимых новых чисел нет — правило «одно
число — один источник» не применимо (UX-раздел ТЗ подтверждает: новых текстов
и элементов нет).

## Как проверялось

Дешёвые гейты подтверждены зелёным прогоном Validate на этом SHA (ссылка в
задаче ревью) — `tsc --noEmit`, `npm test` (2543/2543), `npm run build` и
сверку трёх копий бандла не повторял. Дополнительно сам прогнал
`npm run bundle:sync` (пересобрал `dist` из исходников) и сверил рабочее
дерево `git status` до нуля — подтверждает, что закоммиченный бандл побайтово
совпадает с тем, что даёт текущий `src/**` (не только с тем, что видел CI).

Мутационный гейт по диффу (6 шардов, job «Мутанты по диффу») зелёный на этом
SHA — это тот же Validate-прогон, отдельно не гонял. Отдельно сам применил
патч нового мутанта `config-reload-drops-asset-gap-ownership` (убрал
`isCurrent` из вызова `_adoptAuthoritative` в `reloadConfigOnly`), пересобрал
бандл и прогнал `demo/smoke_config_reload_race.mjs` вручную — мутант поймал:
4 из 24 полей смока покраснели (`lateAssetCannotRegress`,
`lateAssetHasNoTail`, `lateAssetCannotRegressCache`, `lateAssetNotVisible`),
ровно те, что доказывают AC1/AC2. Затем откатил патч и вернул бандл в чистое
состояние (`git status` пуст).

Браузерные смоки Validate пропустил все шарды (диапазон push — не кандидат
беты). Прогнал сам: `node scripts/smoke-select.mjs --base origin/dev --head
HEAD` дал 37 «прямых совпадений» (символы `_reloadConfigOnly`, `_cfgRev`,
`_adoption`, `_getAuthoritativeConfig`, `_maybeRebuildDevices`,
`_beginContinuityCandidate`, `_saveConfigDebounced`, `_showToast`,
`_restoreZoom` и др. на изменённых строках) и 47 «слабых связей». Все четыре
смока, названных в AC9 отдельно (`smoke_save_race`, `smoke_plan_upload_race`,
`smoke_ws_resilience`, `smoke_version_recovery`), попали в прямое совпадение —
прогнал их. Дополнительно прогнал новый `smoke_config_reload_race.mjs` и ещё
9 смоков из прямого совпадения, наиболее тесно завязанных на reload/continuity/
zoom/virtual-light путь: `smoke_post_write_adoption`, `smoke_cold_view_toggle`,
`smoke_cold_view_vacuum`, `smoke_v8_draft_write`, `smoke_danger_confirmation`,
`smoke_summary_panel_polish`, `smoke_zoom_out`, `smoke_linked_virtual_light`,
`smoke_virtual_light_toggle`. Все 13 запущенных смоков — зелёные. Оставшиеся
24 «прямых совпадения» и все 47 «слабых связей» не гонял: они пересекаются с
изменёнными строками по широким символам (`_maybeRebuildDevices`, `_cfgRev`,
`_showToast`), не по самой изменённой логике reload-ownership, а задачу с её
собственным полным гейтом (`gate:small` + весь набор из плана автотестов)
автор уже прогнал согласно комментарию о передаче в код-ревью.

Юнит-тесты (`test/config-adoption.test.mjs`,
`test/config-reload-authority.test.mjs`, `test/config-adoption-ownership.test.mjs`,
`test/version-recovery-card-contract.test.mjs`) прочитаны построчно. Для AC1
и AC8 лично проверил дисциплину «тест умеет падать»: вручную вырезал первую
`isCurrent()`-проверку сразу после `prepareImage` (ту, что АС1 называет
«post-asset claim check») — юнит-тест `#543: a request superseded inside
prepareImage adopts no body, revision or reload tail` покраснел (получил
`asset-wait` вместо `superseded`, плюс лишние `note:asset-failed`/
`scheduleLoadRetry`). Откатил, дерево снова чистое.

`npm run invariants` и `python -m pytest tests_backend` не запускал — geometry/
Python не тронуты. Perf-профили не запускал — не названы в AC, чувствительные
к перфу пути не тронуты (изменение — O(1) проверки владения, без таймеров и
новых подписок; см. ниже про бюджет).

## Разбор по контракту

**К1 (один владелец попытки).** `ConfigReloadAuthority.begin()` выдаёт
непрозрачный `claim` (sequence+lifecycle+context+baseline) до первого сетевого
await в `reloadConfigOnly()`. `isCurrent()`/`claimCurrent()` сверяет claim с
текущим состоянием синхронно при каждом обращении. Более новая попытка,
стартовавшая позже (`begin()` продвигает `currentSequence`), автоматически
делает старый claim непроходным независимо от того, чей `response`/`prepareImage`
завершился раньше — проверено юнитом «ordinary event high-water rejects a late
lower observation…» и смоком (`assetWinnerAdopted`/`networkWinnerAdopted`
и оба «поздний победитель не откатывает» сценария).

**К2 (проверка на общей границе).** `adoptAuthoritativeGated()` проверяет
`isCurrent()` три раза: на входе, сразу после `prepareImage()` (до чтения
`assetReady` — это и есть обязательная АС1-проверка), и непосредственно перед
`adoptStructuralResponses()`. Юнит-тест `#543: a request superseded inside
prepareImage…` детерминированно доказывает срабатывание средней проверки
(deferred-promise матрица до/после `prepareImage`). Третья проверка (строка
460, помечена комментарием «No await follows this check…») эмпирически
избыточна: между ней и предыдущей проверкой (или входной, если структурных
изменений нет) в текущем коде нет ни одного await — я убрал её вручную,
пересобрал бандл и прогнал весь смок `smoke_config_reload_race.mjs` плюс юнит
AC1 — ничего не покраснело. Не блокирую: сам код и его комментарий честно
описывают, что await'ов после неё не бывает, и позиционируют её как
защиту «последней синхронной точки перед adoptStructuralResponses» на случай
будущей правки, которая вставит await между строками 450/461 и забудет про
инвариант. O(1), лишней работы не создаёт (К9). Фиксирую как наблюдение, не
как находку — фикс не нужен.

**К3 (атомарная пара).** Не изменено: `adoptStructuralResponses(host, cfgResp,
layResp)` остаётся одним синхронным вызовом (#500), теперь дополнительно
защищённым isCurrent()-проверками с обеих сторон асинхронного разрыва.

**К4 (session high-water для событий).** `observeRevision()` считает floor как
`max(acceptedRevision, observedHighWater)` и требует строго большего значения;
`invalidateLifecycle()` сбрасывает high-water на новую generation. Проверено
юнитами (`ConfigReloadAuthority` тест-файл, 5 тестов) и смоком (rev4→rev3
отклонён, rev5 принят; echo текущей revision не читает сервер).

**К5 (защита baseline).** `claimCurrent()` сверяет `baselineRevision`/
`baselineFingerprint`, зафиксированные в `begin()`, с текущими — принятая
локальная/paired запись меняет fingerprint и аннулирует claim. Проверено
смоком (`staleReadCannotReplaceLocalWrite`, включая неизменность Undo-связанного
`tail`-снимка).

**К6 (lifecycle fail-closed).** `invalidateLifecycle()` вызывается в
`disconnectedCallback()` и `_leaveCardRoute()`; `observeContext()` — в
`connectedCallback()` и `willUpdate()` при `changed.has('hass')`, инвалидируя
при смене `connection`/`userId`/`route` по строгому сравнению (включая смену
объекта `connection` при неизменной строке). Проверено юнитом и смоком (четыре
lifecycle-ветки: route/user/connection/reconnect — все `true`, плюс
`newLifecycleCanReload` подтверждает, что тот же элемент вновь может
перезагрузиться в новом lifecycle).

**К7 (force/restore).** `begin({force:true})` вызывает `invalidateLifecycle()`
безусловно — новая generation, высокий water сбрасывается, allowed принять
меньшую ревизию; `isCurrent()` игнорирует `writePending` только для `force`.
Проверено юнитом («force recovery may run while its rejected writer unwinds…»)
и смоком (`forceDuringWriteAcceptedLowerRevision`, `oldDeferredEventExpired`,
`restoredEchoSkipped`, `restoredHigherEventAccepted`).

**К8 (ошибки только текущего владельца).** `catch`-блок в `reloadConfigOnly()`
проверяет `isCurrent()` перед `_showToast`; `finally` не трогает
`_continuityDataReady`/`requestUpdate()`, если попытка не текущая и не была
settled. Проверено смоком (`noStaleToastOrRetry`).

**К9 (нет лишней работы).** Проверки — синхронные сравнения полей, O(1);
таймеров/подписок не добавлено (единственный `setTimeout` — прежний
retry-after-write, поведение изменено намеренно, см. ниже); рендеров на
успешный adopt столько же, сколько было до правки (`requestUpdate()` после
adopt + в `finally`, как и в старом коде).

## Наблюдение, не влияющее на вердикт: retry-путь после локальной записи

Раньше `_reloadConfigOnly` при отложенном (из-за `_cfgWriting`) событии
перезапускал себя тем же `observedRev`. Новый код в этой ветке
(`config-reload-authority.ts`, колбэк `setTimeout`) намеренно вызывает
`reloadConfigOnly(host, false)` **без** `observedRev` — если бы `observedRev`
передавался повторно, `observeRevision()` отбросил бы попытку как `revision <=
floor` (high-water уже равен этому же значению). Ни один юнит или смок не
проверяет напрямую именно этот «счастливый путь» (событие отложено при
записи → запись завершилась → retry реально перечитывает и принимает новые
данные) — из проверенного покрыт только «протухший» вариант
(`oldDeferredEventExpired`). Сам эмпирически проверил вручную (одноразовый
скрипт поверх `demo/serve.mjs`, не коммитился): при `_writesPending>0`,
событии с более высокой ревизией и последующем снятии `_writesPending`
захваченный `setTimeout`-колбэк успешно перечитывает сервер ровно один раз и
принимает новую конфигурацию. Этот путь не тестировался и до #543 (проверено
по `origin/dev`) — не регрессия задачи, но пробел в покрытии именно того кода,
который #543 переписал. Low, не блокирует; можно закрыть добавлением одного
юнита/смок-сценария в следующей задаче, либо запиской «проверено вручную,
не автоматизировано» остаётся на усмотрение автора.

## Что проверено и корректно

- AC1–AC9 — все проверены построчно по коду и подтверждены тестами/смоками,
  включая ручную проверку «тест умеет падать» для AC1 и «мутант ловится» для
  AC8 (см. выше).
- AC7: `test/config-adoption-ownership.test.mjs` обновлён (добавлен
  `src/config-reload-authority.ts` в список адоптеров через единственный шов
  `_adoptAuthoritative`) и остаётся статическим ratchet — задача явно не
  опирается на него как на свидетеля async-порядка (условие SPEC-REVIEW r1/r2
  выполнено).
- Trailers: `Issue: #543`, `User-Visible: yes` на коммите; оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же коммите,
  текст на пользовательском языке без внутренних терминов reload/claim/owner.
- `docs/ARCHITECTURE.md` получил абзац про новый owner-контракт, соответствует
  коду.
- Пересчёт `INITIAL_VIEW_GZIP_CEILING` (288 300 → 288 900) документирован с
  измеренным фактом (288 226 Б, запас 674 Б) и причиной; общий бюджет не
  менялся.
- Изменение поведения `_beginContinuityCandidate` (раньше вызывался
  безусловно в начале `_reloadConfigOnly`, теперь — только для победившей
  попытки внутри `adoptAuthoritativeGated`, при структурном изменении) —
  прямое следствие К2 (проигравшая попытка не должна запускать continuity
  candidate). Проверено 13 смоками из прямого совпадения выше — регрессий не
  нашёл.
- Геометрия/layout/i18n/UI не тронуты — соответствует «Не-скоуп» ТЗ.

## Чего не проверял

- Полный набор из 246 браузерных смоков и golden — не требуется (не PR/не
  кандидат беты, геометрия/рендер не тронуты); прогнал только направленную
  выборку (см. «Как проверялось»).
- `npm run invariants` — не требуется, geometry/layout не тронуты.
- `pytest tests_backend` — не требуется, Python не тронут.
- Performance-профили — не названы в AC, не тронуты чувствительные пути.
- Частота гонки на реальном HA (аудит прямо пишет: не измерялась) — вне
  скоупа code-review, это продуктовый риск, зафиксированный ещё в S2.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/543-config-reload-ownership`, коммит `a1fac44d72a4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d204d7bc476bb844793ee9f640ffc442815df7f8`
  ```
  git log --all --format='%H %T' | grep d204d7bc476b
  ```
- Тело issue: `18a8083126ef98f841e6dd8e670203f8c016ea805af7a9dbefcc54aacb7d7cf1`
- Вердикт конвейера: `green` · High 0
