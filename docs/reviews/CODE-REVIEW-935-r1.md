# CODE-REVIEW-935-r1

Issue: #935 «Редактор устройств: контекстное меню и копирование в виртуальное устройство»
Трек: `ask` · этап: code · заход: r1 · блокирующих циклов использовано 0/4
Материал: `24015ad8d55481368ee9755ef22fceef95eb49a4` (`issue/935-copy-device`, подтверждено `git rev-parse HEAD` и `git ls-remote origin issue/935-copy-device`)
Диапазон: `git diff origin/dev...HEAD` — 42 файла, +1547/-27

## Скоуп

Серия из 4 коммитов:
1. `f32f68c4` feat(devices): copy markers into independent virtual devices
2. `5a1c54f8` fix(devices): explain refused copy control links
3. `f2802d89` test(devices): align copy-menu and independent-reader witnesses
4. `24015ad8` fix(devices): retain contact wall geometry across decor transforms — узкое
   согласованное владельцем расширение скоупа (комментарий 2026-10-17 06:21:49 в
   issue), снимающее общий performance-блокер редактора, обнаруженный при первом
   прогоне обязательного CI этой же задачи. Не трогает модель/пороги/алгоритм
   агрегации, только fingerprint-проекцию существующего контактного адаптера.

Все четыре коммита несут `Issue: #935` и `User-Visible: yes`, оба changelog
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правятся в тех же коммитах.
Ledger `docs/release-ledger/v1.81.0/935.json`: `category: major` относительно
предыдущего stable `v1.81.0` — обоснованно: новая пользовательская команда,
отсутствовавшая в 1.81.0, не чинит промежуточную бета-регрессию. Второй коммит
(`5a1c54f8`) и четвёртый (`24015ad8`) — внутрибетные исправления найденных в
этой же работе дефектов (right-button arming drag; decor-triggered masonry
rebuild), `introducedBy` не требуется — обе ошибки введены первым же коммитом
этой задачи, не отдельным прошлым циклом.

Работа закрывает J4/J6 (`docs/SCOPE.md`): быстрое тиражирование одинаково
настроенных значков на плане без создания HA-сущностей/устройств. Копирование
не делает ни одного HA service call — явно и многократно проверено (unit,
backend event listener, native `services` spy).

## Как проверялось

Дешёвые гейты подтверждены внешней ссылкой на зафиксированном SHA и
перепроверены мной по `gh run view`, а не приняты на слово:

| Гейт | Статус | Как подтверждено |
|---|---|---|
| `Проверка (CI)` (workflow_dispatch) run `39011259813` | success, `headSha=24015ad8…` | `gh run view 39011259813 --json conclusion,headSha` — совпадает с материалом ревью |
| → job «Смоки: все шарды зелёные» (3/3 шарда браузера, 367 смоков) | success | `gh run view 39011259813 --json jobs` |
| → job «Golden-кадры против принятых эталонов» | success | там же |
| → job «Перф-смок: бюджет времени кадра» | success | там же |
| → job «Фронтенд: типы, юниты, мутанты, синхрон бандла» | success | там же |
| `Бэкенд: pytest в Home Assistant` | **skipped** (не красный) | `needs.changes.outputs.backend==false` на этом SHA — `24015ad8` не трогает `.py`; backend-дерево не менялось с предыдущего push, где backend уже прогонялся (job «Переиспользование: это дерево уже проверено» = success) |
| `Полные бенчмарки производительности` run `39011771887` | success, `headSha=24015ad8…` | `gh run view 39011771887 --json conclusion,headSha` |
| → `large-house-interaction-v1` до/после правки, одна машина, 7 измерений | PASS (570,6 мс / 96 мс / 96 мс против лимитов 750/165/300) | таблица в комментарии автора 2026-10-17T07:03:49Z, числа согласуются с diff (новая узкая правка `wallFingerprint`/`withoutDecor`) |
| Ветка `issue/935-copy-device` указывает на материал | — | `git ls-remote origin issue/935-copy-device` → `24015ad8…`, совпадает |

Это закрывает «всегда»-гейты (`typecheck`/`npm test`/`npm run build`+bundle) и
применимые по диффу/AC гейты (смоки — полный матрикс прогнан в Validate,
golden — т.к. `ci:golden`/`ci:full` стоит на issue, performance — т.к. задача
явно его чинит). Я не перегонял их локально — правило #343 разрешает это при
зелёном Validate на точном SHA, что я отдельно сверил через `gh run view`, а
не принял по номеру из текста.

**Чего не проверял и почему:**
- Сам `npx tsc --noEmit` / `npm test` / `npm run build` локально не запускал —
  зелёный Validate на этом самом SHA уже это покрывает (см. таблицу), а
  повторный прогон ничего нового не доказал бы.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` запустил сам
  (не было в хендоффе явного вывода для сверки): 200 «прямых совпадений» из-за
  широко используемых host-port символов (`_cfgRev`, `_mode`, `_editorRuntime`
  и т.п.); все они покрыты полным browser-smoke матриксом Validate (3/3 шарда,
  зелёный), а не только 23 именованными в хендоффе смоками — гейт выполнен с
  запасом, а не частично.
- `node scripts/mutation-gate.mjs --check` и сам прогон реестра мутантов не
  выполнял — это ночной гейт (#709), при разработке/ревью не запускается;
  принял статическую регистрацию 7 новых определений как есть (проверил
  `scripts/mutation-registry.mjs` чтением — все 7 валидны и находят ровно одно
  вхождение `find` в целевом файле).
- Ручная GPU/owner-приёмка не выполнялась и не требуется (#929).
- Полный `python -m pytest tests_backend` и адресный `test_ha_marker_copy.py`
  лично не перегонял — см. выше про `reuse`/skip; значения автора (1535/1
  skipped, 23/23 адресных) не противоречат содержимому `tests_backend/test_ha_marker_copy.py`,
  который я прочитал целиком (10 тестов, все поднятые в хендоффе кейсы
  действительно присутствуют в файле).
- Свежесть скриншотов документации не гейт задачи (#697).

Основной бюджет раунда потрачен на чтение кода: `src/device-copy.ts`,
`src/device-copy-editor.ts`, `custom_components/houseplan/marker_copy.py`,
диф `websocket_api.py`, `src/floor-geometry-key.ts` + `src/device-contact-card.ts`,
всю проводку в `src/houseplan-card.ts`/`src/houseplan-editor-runtime.ts`/`src/led-strip-editor.ts`,
все новые/изменённые тесты (`test/device-copy.test.mjs`, `test/device-copy-editor.test.mjs`,
`test/device-contact-card.test.mjs`, `tests_backend/test_ha_marker_copy.py`,
`demo/smoke_device_copy.mjs`, правки `demo/smoke_tap_ctx.mjs`/`smoke_modes.mjs`/`smoke_device_contact_work.mjs`),
i18n (все 4 языка), `scripts/coordinate-write-barrier-guard.mjs`,
`scripts/bundle-budget.mjs`/`test/core-file-budget.test.mjs` (ratchet), ledger,
changelog, ARCHITECTURE/STATUS/USER-GUIDE.ru.md.

## Риск по изменённым участкам (#707) — сверка с AC ТЗ

| Класс | Токен | Покрыт AC | Как |
|---|---|---|---|
| geometry | `canonicalizePosition` (`device-copy-editor.ts:131`) | AC5, AC9 | Позиция из `deviceCopyPosition` канонизируется перед отправкой; `coordinate-write-barrier-guard.mjs` расширен новым инвариантом `frontend marker copy transaction`, требующим, чтобы `canonicalizePosition(...)` и `position: pos` лежали в одном окне 150 символов перед WS-вызовом — предотвращает регресс «несогласованная координата ушла на сервер в обход канонизации». |
| touch | `PointerEvent`/`pointerdown`/`contextmenu` (`device-copy-editor.ts:44,54,70,80`; `led-strip-editor.ts:643`) | AC2 | Новый контекст-менеджер не добавляет собственного touch-жеста — только родной DOM `contextmenu`; единственное защитное изменение `if (ev.button !== 0) return;` в `_pointerDown` не затрагивает touch (на touch `PointerEvent.button` всегда `0`), что подтверждено необходимостью добавить `button: 0` только в синтетические **мышиные** фикстуры `smoke_modes.mjs`/`smoke_tap_ctx.mjs`. Проверено чтением, не исполнением touch-сценария: отдельного touch-теста на copy-меню нет, но код не вводит новых touch-обработчиков, а существующий touch-гейт (`smoke_isometric_live_touch`, `view_hold_lifecycle` и др. из заявленного списка 23 смоков) прошёл в полном Validate без изменений своей логики. |
| migration | `files/migrate` (`device-copy-editor.ts:121`, `websocket_api.py:ws_files_migrate`) | AC3 | Существующая команда переиспользована как есть; добавлена только общая квота (`check_quota` + `rt.upload_lock`) — доказано `test_issue_935_concurrent_attachment_copies_respect_existing_store_quota` (один победитель при исчерпанной квоте, байты оригинала не тронуты) и зарегистрированным мутантом `copy-attachments-bypass-upload-quota`. |
| devices | `websocket_api.py` (новый `ws_marker_copy`, правки `ws_files_migrate`) | AC4, AC6, AC9 | 10 backend-тестов в `test_ha_marker_copy.py`: append-only config/layout, parametrized отказы (`config_rev`/`layout_rev`/`source`/`binding`/`space`/`role`/`id`/`self`/`cycle`/`missing_target`) с проверкой, что обе пары не изменились; ACL read-only; 5 фаз сбоя записи (`before_config`/`after_config`/`after_layout`/`persistent`/`recovery`) с восстановлением через существующий `_commit_pair`/rollback; конкурентные копии — один победитель, `conflict` у второго; автоматическое устройство без Marker тоже копируется. |
| ux | 10 новых ключей `device.copy*` (`de.json:2-6` и др.) | AC7, UX-раздел | RU/EN/DE/FR добавлены одним коммитом (`f32f68c4`), 10 ключей идентичны по набору во всех 4 файлах; `smoke_device_copy.mjs` проверяет точный видимый текст EN (`'Copy device'`) и локализованные тосты по кодам ошибок. |

Все пять классов из риск-блока имеют прямую привязку к конкретному AC и
автоматическому свидетелю — переклассификация не требуется (`track:ask` уже
назначен владельцем, `route: fix`).

## Находки

Находок нет — ни High, ни Medium, ни Low.

Проверенные потенциально спорные места, признанные корректными:

1. **Роль «Всегда» при копировании реального светильника** (`virtualDeviceCopy`,
   `device-copy.ts:48-57`): `ownLight = is_light===true || hasOwnSpatialSource(...) || (is_light!==false && primary.startsWith('light.'))`;
   `marker.is_light = true` только если `ownLight || incoming.length`. Для
   исходного `is_light:false` без входящих связей роль остаётся `false`
   (копия обычного `Never`-реле не форсится) — ровно случай из ТЗ п.5/ответа
   владельца («это действует и при исходном "Никогда", **если** входящая
   связь направлена на собственное HA-реле»). Подтверждено unit-тестом
   `incoming marker/entity edges...` (relay с `is_light:false`+`incoming=[]`
   → `is_light:false`; тот же relay + `incoming=['controller']` → `is_light:true`).
2. **Храповики бюджета** (`LAZY_EDITOR_GZIP_CEILING` 265955→268449,
   `houseplan-card.ts` CAP 13046→13097, dist ~+0,41%): измерены
   `bundle:budget`/`lint:unused` без правки сборщика/предикатов, обоснование в
   коммите и issue, полоса 2000 Б / 50 строк не менялась, абсолютный
   initial-View бюджет не менялся — соответствует допуску PROCESS §2.7/§8 на
   документированную правку конкретных потолков в коммите задачи.
3. **Орфанные файлы копии при отказе подготовки вложений**
   (`ARCHITECTURE.md`: «Failed preparations may leave unreferenced staged
   files under the new ID, not partial visible markers»): это не найденный
   дефект, а буквальная реализация ТЗ п.10 («без созданного наполовину
   устройства… Подготовленные файлы копии не становятся видимыми настройками
   при отказе») — ТЗ не требует их удаления, только невидимости; ограничено
   существующей квотой (`MAX_FILES_BYTES/MAX_FILES_COUNT`), так что роста без
   предела нет.
4. **`_pointerdown` `ev.button !== 0` guard**: помещён после gate по режиму
   и перед `_deviceDragRetirement.begin(...)` — чинит реальный найденный автором
   баг (правая кнопка вооружала drag раньше `contextmenu`); зарегистрирован
   мутант `copy-context-arms-right-button-drag`
   (guard: `node demo/smoke_device_copy.mjs`, execution=0/caught=unknown —
   честно не исполнялся, ночной).
5. **LED-копирование** (`led-strip-editor.ts:643`): `contextmenu` на
   `.led-select-hit` открывает то же меню только когда `this.device(strip.marker)`
   резолвится; незакреплённые LED-штрихи без Marker не получают новый пункт
   меню — родное браузерное меню остаётся, как и раньше. Native smoke
   `ledOriginalStillStrip`/`ledCopyOrdinaryIcon`/`ledGeometryUnchanged`
   подтверждают п.8 ТЗ дословно.
6. **Lost-reply / double-submit** (`device-copy-editor.ts:155-164`): после
   исключения, если `sent===true`, код перечитывает обе стороны и ищет тот же
   `id`, не создавая второй; `operation`-счётчик и `busyContext`/`authority()`
   гасят устаревший колбэк при смене контекста/HA/этажа. Подтверждено unit
   `superseded HA reply cannot adopt…` и native `lostReplyOneWrite`/`lostReplyOneMarker`.

## Что проверено и корректно (резюме по AC)

- **AC1** — одно меню, hit-owner, Esc/outside/focus/Tab, View не получает
  copy, 0 service calls: unit (`device-copy-editor.test.mjs`) + native
  (`smoke_device_copy.mjs`: `one-menu-item`, `escape-*`, `outside-closes-menu`,
  `view-keeps-more-info-not-copy-menu`, `all-copy-actions-service-free`).
- **AC2** — первый свободный номер ≥2, дубль-клик/двойной выбор не создаёт
  вторую копию: unit `nextDeviceCopyName` (6 табличных кейсов) + native
  `copy-numbered-source-reuses-same-series`, `pending-copy-cannot-open-second-command`.
- **AC3** — независимость настроек/вложений, материализация HA-иконки/роли/
  цвета/яркости, отсутствие own-binding/state/battery: unit
  deep-independence (мутация копии не трогает `before`-снимок оригинала),
  backend `test_issue_935_attachment_copy_keeps_original_bytes_and_has_independent_url`,
  native `cold-reader-retains-independent-virtual-copy`,
  `editing-copy-does-not-rename-original`.
- **AC4** — исходящие сохранены, входящие продублированы `marker:<copy-id>`,
  self/cycle/missing-target отклонены целиком: unit `deviceCopyIncoming` +
  backend `test_issue_935_refused_copy_preserves_both_stores` (10 кейсов) +
  native `incomingAppended`/`outgoingKept`.
- **AC5** — соседняя позиция, без перекрытия, вне комнаты/0..1 разрешено,
  LED не дублируется: unit `deviceCopyPosition` (плотная упаковка, обстрkles,
  `maxRings=0`→`null`, `±5000` предел→`null`) + native LED-блок.
- **AC6** — CAS/ACL/краш-рекавери/устаревшее меню/double-ID: backend
  5 фаз сбоя + concurrent-тест + ACL-тест; native stale-config/permission-loss/
  rejected/held/lost.
- **AC7** — холодный читатель, RU/EN (+DE/FR) parity: native
  `cold-reader-retains-independent-virtual-copy`, i18n diff всех 4 файлов
  идентичен по набору ключей.

## Вердикт

Зелёный. Реализация полно и корректно закрывает контракт ТЗ #935, включая все
три решения владельца (роль светильника, LED как обычный значок, позиция вне
контура комнаты), не вводит сервисных вызовов, сохраняет touch-инварианты и
безопасность LED/geometry-гейтов, и устраняет найденный в процессе общий
performance-блокер редактора по явному разрешению владельца с измеримым
доказательством на материале точного SHA. Находок нет, бюджет цикла не
расходуется.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/935-copy-device`, коммит `24015ad8d554` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2f26c02f40ead73a787a059cdc0a064658629244`
  ```
  git log --all --format='%H %T' | grep 2f26c02f40ea
  ```
- Тело issue: `56916a3eec0f96e16ed8a44baba9f42214707f63f58e25d4be2ebfda5314c989`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNTksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzQ5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTgsIm91dHB1dF90b2tlbnMiOjM2NTQwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2MjMwMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjc2Mzg4MDEsImNvc3RVc2RFc3RpbWF0ZSI6Mi41NDI2MDQyMDAwMDAwMDA0fV0sInR1cm5zIjo2OSwiZHVyYXRpb25NcyI6NDU1MzQyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi41NDc5NTMyMDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5377 output_tokens=36558 cache_creation_input_tokens=162302 cache_read_input_tokens=7638801 num_turns=69 -->
