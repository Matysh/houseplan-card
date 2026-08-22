# CODE-REVIEW-244-r1

- Issue: [#244](https://github.com/Matysh/houseplan-card/issues/244) — восстановление маркеров с мёртвой ссылкой на пространство
- Кандидат: `a09338f` (ветка `issue/244-orphan-space-references`)
- ТЗ: `docs/specs/244-orphan-space-references.md`, утверждено `SPEC-REVIEW-244-r2` (зелёное)
- Заход: код-ревью **r1**, блокирующих циклов израсходовано **0/4**
- Диапазон: `git diff origin/dev...HEAD` (`origin/dev` = `b49983f`)

## Скоуп

Normal-трек (метки `bug`, `P2`, без `small`/`trivial`). Диапазон трогает: новый чистый helper
`src/space-reference-repair.ts` (Optimize reference-repair pass), `src/space-deletion.ts`
(preflight-кандидат удаления пространства), интеграцию в `src/plan-optimizer.ts`
(`PLAN_MODEL_VERSION` 6→7), редактор карточки (`src/editor.ts` + новый
`src/card-editor-validation.ts`), backend `custom_components/houseplan/websocket_api.py`
(новая команда `houseplan/space/delete`) и `import_export.py` (`_repair_target_space_refs`),
плюс тесты (unit/backend/smoke/golden/mutation) и документацию. 40 файлов, +3193/-858.

Полный разбор (не по дельте): это первый заход код-ревью по этапу (спек-ревью — другой этап,
его бюджет не пересекается с код-ревью, #227/§10.4).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS |
| Unit | `npm test` | **1112/1112 PASS**, 0 skipped (на Linux `docs-accept.test.mjs` не падает — заявленные автором 3 FAIL/1 skipped специфичны для Windows path-separator, #246) |
| Build + bundle sync | `npm run build && cmp ×3` | PASS, все три копии побайтово совпадают, SHA-256 `7db489bf…f2203` — совпадает с заявленным в хендоффе |
| Docs fingerprint | `node scripts/check-docs.mjs` (diff трогает `src/**`) | PASS |
| Backend | `python -m pytest tests_backend -q` (поднял `pytest-homeassistant-custom-component` + `home-assistant-frontend==20250109.2` в сессии ревьюера — на Linux, полный HA-харнесс) | **350 passed**, 1 error — `test_ha_upload.py::test_upload_ok`, воспроизведён и на чистом `origin/dev` (тот же `_run_safe_shutdown_loop` teardown-артефакт), не связан с диффом |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 19 прямых совпадений, 29 слабых связей (вывод ниже) |
| Целевой smoke по AC | `node demo/smoke_orphan_space_references.mjs` | **FAIL** — см. находку H1 |
| Смежный smoke (прямое совпадение на `_deleteSpace`) | `node demo/smoke_optional_space_model.mjs` | **FAIL, 5/9** — см. находку H2, регрессия относительно `origin/dev` (проверено: тот же smoke зелёный на `b49983f`) |
| Смежный smoke (прямое совпадение на Optimize-диалог) | `node demo/smoke_optimize_geometry_preflight.mjs` | PASS |
| Смежный smoke (прямое совпадение на `_formData`/`_valueChanged`) | `node demo/smoke_fixed_floor.mjs` | PASS |
| `npm run golden:verify`, полный smoke-набор (167), `mutation-gate.mjs` (backend-мутанты), performance | — | не прогонялись целиком — см. «Чего не проверял» |

### Решение по каждой строке `smoke-select`

**Прямое совпадение (19)** — прогнаны 4 (см. таблицу выше: `smoke_orphan_space_references`,
`smoke_optional_space_model`, `smoke_optimize_geometry_preflight`, `smoke_fixed_floor`), это
единственные, где символ прямо принадлежит изменённой логике удаления/Optimize/редактора, а не
общей инфраструктуре записи. Остальные 15 (`smoke_linked_virtual_light`, `smoke_save_race`,
`smoke_virtual_light_toggle`, `smoke_audit_1490`, `smoke_bg_color`, `smoke_config_writer`,
`smoke_device_preview_parity`, `smoke_dialog_footer_width`, `smoke_general_settings`,
`smoke_layout_sync`, `smoke_plan_upload_race`, `smoke_climate_once`, `smoke_editor_tabs`,
`smoke_infinite_canvas`, `smoke_ws_resilience`) не прогнаны: совпадение только по общей
плумбингу (`_cfgRev`, `_layoutRev`, `_config`, `_persistLayout`, `_reloadConfigOnly`,
`buildDevices`, `Layout`), который #244 не переопределяет — эти символы читаются, а не
переписываются новым кодом. Риск ложноотрицательного результата счёл низким, но именно эта
экономия и не поймала находки этого документа (H1/H2 нашлись на прямых совпадениях, которые я
всё-таки прогнал) — сигнал в пользу того, что общий плумбинг здесь надёжен, а не наоборот.

**Слабая связь (29)** — не прогнаны. Все совпадения по одному распространённому имени
(`_config`, `_spaceDialog`, `_cfgRev`), диалоги пространства/цвета/тегов не меняли контракт в
этом диффе.

## Находки

### H1 (High). Именованный в АС смок `demo/smoke_orphan_space_references.mjs` красный

`node demo/smoke_orphan_space_references.mjs`:

```
"deleteExplainsBlockerWithoutConfirmOrWrite": false
FAILED (1): deleteExplainsBlockerWithoutConfirmOrWrite: expected true, got false
```

Этот файл — единственная браузерная улика для AC1, AC7, AC9, AC10, AC11 (спек §15). Причина
красного: сценарий делает Optimize-Apply (маркер `orphan` детачится, `marker.space` становится
`undefined`) → Undo (мок возвращает исходную пару, `marker.space` снова `'gone'`) → затем
открывает диалог пространства `'home'` и вызывает `_deleteSpace()`. Но у маркера `orphan` в этот
момент `space === 'gone'`, а не `'home'` — он никогда не ссылался на удаляемое `'home'`.
`collectSpaceMarkerDependencies(serverCfg, layout, 'home')` честно возвращает `count: 0`, код
идёт в `confirm()` (что должно быть `nativeConfirmCalls === 0` по тесту) и затем в
`hass.callWS('houseplan/space/delete', …)`, который мок безусловно бросает `space_in_use` —
попадает в другую (catch) ветку, а не в ожидаемый preflight-блокер.

Сам механизм блокировки удаления работает верно — проверено отдельно, воспроизведением на чистой
фикстуре (маркер реально ссылается на удаляемое пространство):

```
node /tmp/smoke_delete_isolated.mjs
{ "blockerText": "This space is still used by 1 device(s). …", "nativeConfirmCalls": 0,
  "calls": [], "deleteBlockers": 1 }
```

Это подтверждено и `space-deletion.test.mjs`, и `test_ha_websocket.py` (unit/backend зелёные).
Дефект — в фикстуре смока (несвязанные `'gone'`/`'home'`), не в продуктовом коде. Но: (а) это
именно тот артефакт, который спек называет доказательством пяти AC разом; (б) хендофф прямо
говорит, что браузерные smoke в implementation-цикле не запускались, хотя `demo/smoke_orphan_space_references.mjs`
прямо назван в AC1/AC7/AC9/AC10/AC11 и AGENTS.md требует прогонять AC-смоки локально перед
`S7-code-review`; локальный прогон занял бы секунды и поймал бы фикстуру до подачи на ревью.
«Verified» по этим пяти AC без названной команды и результата не является доказательством —
здесь команда есть, и она красная.

**Что нужно:** починить фикстуру `demo/smoke_orphan_space_references.mjs` — дать `_deleteSpace`
блокатор, реально ссылающийся на удаляемое пространство (например, отдельный второй маркер с
`space: 'home'`, не участвующий в Optimize-цикле), и убедиться, что смок целиком зелёный.

### H2 (High). Регрессия контракта #113: последнее занятое пространство больше не удаляется

`node demo/smoke_optional_space_model.mjs` (не тронут диффом, прямое совпадение по `_deleteSpace`):

```
"deleteLastRendersEmpty": false, "deleteLastClearsSelection": false,
"deleteLastAbortsEditorState": false, "deleteLastCancelsPendingWrite": false,
"createFlowSurvivesEmpty": false
FAILED (5)
```

На `origin/dev` (`b49983f`, тот же smoke, тот же билд-процесс) — **зелёный**:

```
node demo/smoke_optional_space_model.mjs   # на чистом origin/dev
OK
```

Т.е. это не флейк среды, а воспроизводимая регрессия, внесённая именно этим диффом.

Причина: смок вызывает `_deleteSpace()` на единственном оставшемся пространстве demo-фикстуры,
у которого есть реальные маркеры (обычные demo-устройства). Новый preflight
(`collectSpaceMarkerDependencies`, §10 спека, решение владельца по Q2 — «заблокировать удаление…
показать число зависимых маркеров») находит зависимости и **безусловно** блокирует удаление —
без исключения для случая «это единственное оставшееся пространство». `confirm()` не вызывается,
запись не идёт — ни один из пяти шагов теста не выполняется, потому что диалог остаётся открытым
с блокером вместо перехода в пустое состояние.

До этого диффа (`docs`-комментарий смока: «#113: deleting the final space and receiving an
empty plan over WS must be a supported lifecycle state») удаление последнего населённого
пространства было гарантированным способом получить состояние «Пусто» и начать заново. Спек §10
защищает явно только один частный случай — «Удаление последнего **пустого** пространства
сохраняет действующий контракт #111» — молча оставляя населённый последний случай без какого-либо
пути назад: у пользователя с одним пространством и хотя бы одним устройством нет ни другого
пространства, куда перенести маркер, ни кнопки «удалить всё равно». Это деградация ранее
работавшего, покрытого тестом сценария (#113), не названная ни в ТЗ как сознательно отменяемая,
ни в `docs/CHANGELOG*.md`/`CONFIG-COMPATIBILITY.md` (там документируется только общее правило
блокировки, без слова про последнее пространство). Она прошла оба раунда ревью ТЗ незамеченной.

Это ровно тот класс: «правка… способна сломать AC/контракт, который предыдущий раунд признал
выполненным» — деградация смежного сценария при полностью выполненных AC самой задачи.

**Что нужно (варианты для автора/владельца, не мой выбор):**
1. Для единственного оставшегося пространства не блокировать, а применить тот же safe-detach,
   что Optimize уже делает при отсутствии сигнатуры/Area (Q1-семантика) — маркеры теряют только
   мёртвую привязку, пространство всё равно удаляется, состояние «Пусто» достижимо как раньше;
   либо
2. Явное продуктовое решение владельца: контракт #113 сознательно сужается только до пустых
   пространств, задокументировать это в `USER-GUIDE.md`/`CHANGELOG` и **обновить**
   `demo/smoke_optional_space_model.mjs`, чтобы он не утверждал более неверное поведение.

Оставлять как есть (спорный молчаливый выбор + красный регрессионный тест) нельзя.

## Что проверено и корректно

- **AC2–AC6 (граф ссылок Optimize)** — `test/space-reference-repair.test.mjs`, 8 тестов,
  прочитаны построчно: exact signature (обрезанный stem >35, коллизия двух кандидатов, валидный
  оригинал блокирует ремап), Area-remap с точным совпадением-ровно-одна-комната, detach только
  `marker.space`+позиции с сохранением остальных полей маркера (`binding`, `icon`, `pdfs`),
  `room_id`/`vacuum.segment_map`/`rl_<room>` синхронно, removed-tombstone принимает только
  доказуемую сигнатуру. Тесты умеют падать — проверено запуском (`npm test`, все зелёные) и
  чтением: логика в `src/space-reference-repair.ts` использует `Map`/`Set` с точными критериями
  (`reversibleStem`, `spaceSignatures.get(oldId)?.length === 1`), не эвристику.
- **AC12 (immutability/idempotence)** — оба unit-файла явно проверяют, что входной
  `config`/`layout` не мутируется (`assert.equal(input.markers[0].space, 'gone', 'config input is
  immutable')`), повторный прогон `changed:false`; `plan-optimizer.test.mjs` добавляет
  «reference repair is part of exact Optimize candidate and bumps model version» — подтверждено,
  что repair выполняется **до** проверки `model_version` (`src/plan-optimizer.ts:380` вызывает
  `repairSpaceReferences` первой строкой), т.е. не пропускается при уже актуальной версии.
- **AC13 (линейность)** — прочитано: `repairSpaceReferences` строит все индексы (`spaceSignatures`,
  `roomSignaturesBySpace`, `roomsByArea`, `activeMarkerIds`) один раз, дальше только `Map`/`Set`
  lookup на маркер/layout-запись — O(n). Синтетический тест на 120 пространств × 2400 маркеров
  проходит быстро внутри `npm test` (общее время прогона 1112 тестов — 5.6 с).
- **AC8 (импорт одного пространства)** — `_repair_target_space_refs` в `import_export.py`
  прочитан и прогнан (`test_issue_244_space_import_repairs_existing_target_refs_with_exact_map`,
  `..._does_not_repair_target_while_source_exists`) — оба PASS изолированно и в полном прогоне
  с настоящим HA. Ремап `marker.space`/`room_id`/`vacuum.segment_map`/`layout[*].s`/`rl_*` по
  точному `id_map` этого импорта, без эвристики; при существующем `old_space_id` target не
  трогается — подтверждено.
- **AC9/AC10 (backend delete)** — `test_issue_244_space_delete_is_authoritative_and_revision_guarded`
  прогнан с полным HA-харнессом (PASS): блокер оставляет обе revision без изменений, после
  устранения зависимости (tombstone) удаление проходит под revision guard, снимает только
  placement-поля с tombstone, оставляет его `name`. `_space_delete_candidate`/`_commit_import_pair`
  переиспользуют существующий crash-safe pending/rollback механизм Optimize/импорта — код
  прочитан, семантика (retry-once → rollback-intent) идентична уже принятому паттерну.
- **AC11 (default_floor)** — `card-editor-validation.test.mjs` (PASS) плюс smoke-проверка
  `editorKeepsRawInvalidDefault` (PASS в общем прогоне smoke, несмотря на H1/H2 в других
  ассершенах того же файла) подтверждают: raw id сохраняется, alert для RU/EN формируется только
  после авторитетной загрузки. Логика «несвязанное поле не стирает raw id» проверена чтением
  (`_formData` — полный `{...config}`, оба `ha-form` получают его целиком, `_valueChanged` мержит
  `ev.detail.value` в текущий `_config`) — отдельного browser-теста именно на этот сценарий нет
  (см. «Чего не проверял»).
- **AC14** — `check-docs.mjs` зелёный, три копии бандла побайтово идентичны, RU/EN changelog и
  `USER-GUIDE.*`/`CONFIG-COMPATIBILITY.md` обновлены по существу (не только версия), скриншот-
  fingerprint принят коммитом `ecb55d1` со ссылкой на настоящий прогон workflow (не выдумана).
- **i18n** — все новые ключи (`space.delete_blocked`, `editor.default_floor_missing`,
  `gs.optimize_references`, `gs.optimize_reference_warning`, `gs.optimize_reference_more`,
  `backup.repaired_target_refs`) присутствуют параллельно в `en.json`/`ru.json`, текст совпадает
  с тем, что смок и golden-харнесс проверяют побуквенно.
- **Трейлеры/классы файлов** — коммиты несут `Issue: #244`, `User-Visible: yes` с правками в
  оба changelog в соответствующем коммите; `dist/**`/`custom_components/.../frontend/**`
  (класс D) идут вместе с исходниками в том же коммите реализации — не отдельным «само по себе»
  коммитом.

## Чего не проверял

- **`npm run golden:verify` / golden:accept** — не прогонял: новые сценарии (`optimize-orphan-references-*`,
  `card-editor-invalid-default-floor-*`) добавлены в матрицу и проверены `golden-matrix.test.mjs`
  (структурно, PASS), но реальный визуальный рендер не снимался — это предрелizный гейт по
  правилу владельца (§8), эталоны принимаются только на полном Linux CI артефакте.
- **Полный smoke-набор (167 файлов)** — прогнаны только 4 прямых совпадения плюс целевой AC-смок;
  остальные 14 прямых и 29 слабых — не прогонялись, решение по каждой строке дано выше.
- **`scripts/mutation-gate.mjs` для трёх новых frontend-мутантов** (`orphan-space-detach-disabled`,
  `orphan-space-ambiguous-signature-guessed`, `orphan-space-area-keeps-stale-position`) — не
  прогонял сам мутационный прогон (полный прогон гейта требует backend-мутанты и упал в моей
  сессии на отсутствии backend-харнесса до его установки; после установки HA не переповторял
  весь mutation-gate из-за времени). Прочитаны patches/guards — синтаксически и по смыслу
  соответствуют трём рискам из спека §16.
- **Backend-mutation-мутанты (не относящиеся к #244)** и **performance-профили** — не запускал,
  не названы в AC #244 как влияющие.
- **Браузерный тест на «несвязанное редактирование другого поля ha-form не стирает raw
  default_floor»** — только чтением кода (см. AC11 выше), отдельного smoke/golden-шага именно на
  этот пограничный случай нет. Не блокирую отдельно — логика простая и однозначная, но фиксирую
  как пробел покрытия.
- **`docs/images/screenshots.json` PNG-содержимое** — не скачивал артефакт workflow, доверился
  тому, что `imageSha256` не изменился (0 PNG) и ссылка на прогон настоящая (не выдуманная).

## Итог

Продуктовый диагноз, контракт репаунда ссылок и большинство AC подтверждены чтением и
исполнением тестов — работа сделана добросовестно и по существу. Но два независимых прогона
браузерных smoke, которые сам автор не запустил перед подачей на ревью, оказались красными:
один — из-за дефекта фикстуры в named AC-evidence файле, другой — из-за настоящей регрессии
ранее работавшего контракта (#113) без единого слова об этом в ТЗ/changelog. Оба блокируют.

**Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 2 · Medium: 0 → в задаче**

Документ: `docs/reviews/CODE-REVIEW-244-r1.md`
