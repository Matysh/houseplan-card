# CODE-REVIEW-440-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/440
- Этап: код-ревью, заход r1, блокирующих циклов израсходовано 0 из 4 (лимит 4 — задача идёт full-треком)
- Материал: `git diff origin/dev...HEAD`, `git log --oneline origin/dev..HEAD`
- SHA материала (сверено `git rev-parse HEAD` непосредственно перед выводом): `5409f0b2e39f84d2e4ffd19a080b02b8c16849b8`
- ТЗ: `docs/specs/440-v171-beta2-polish.md` (SPEC-REVIEW-440-r1: зелёный, High 0 · Medium 0)
- Первый заход код-ревью — раздела «Унаследовано из r0» и «Закрытие раунда r0» не применяются, разбор полный.

## Скоуп диффа

5 коммитов на ветке `issue/440-audit-polish` (735710f1 ТЗ, 0f513ac8 doc, 53847e39
`fix: harden beta 2 audit paths` — User-Visible: yes, c958e243/5409f0b2
`test:`/`refactor:` — User-Visible: no, оба несут только внутреннее
переразложение уже написанного кода без изменения поведения). Затронуты все
семь пунктов аудита из тела issue:

1. `custom_components/houseplan/asset_integrity.py` — regular-file boundary в
   `_signature()`, конечный `flight.event.wait(ASSET_INTEGRITY_FOLLOWER_TIMEOUT_SECONDS)`.
2. `src/houseplan-card.ts` — `_roomTipEnabledForPointer()` вызывает `_notePointer`
   до проверки `show_room_tooltip`.
3. `src/houseplan-card.ts` — `_dangerConfirmLocaleGate` (getter) →
   `_syncDangerConfirmLocaleGate()` (именованный метод) на всех трёх call site.
4. `custom_components/houseplan/decor_assets.py` + `http_api.py` — TOCTOU-устойчивый
   `_physical_asset_inventory()`, статус `507` только для `capacity_exceeded`.
5. `test/space-card-audit-lows.test.mjs` — блок из пяти source-regex по AC5 #434
   удалён, заменён отрицательным smoke-кейсом + двумя новыми мутантами.
6. `tests_backend/test_coordinate_canonicalization_pure.py` — новый HA-независимый
   модуль, мутанты `image-box-python-canonicalization-omitted` и
   `python-lattice-round-truncates` перенаправлены на него.
7. Пункт (е) — только текст ТЗ/issue, кодовых изменений нет; проверено сверкой
   заявления с фактическим отсутствием диффа по #429/#430.

Плюс сгенерированный класс D (`dist/**`, `custom_components/houseplan/frontend/**`)
и документация (`ARCHITECTURE.md`, `TESTING.md`, оба `CHANGELOG*`,
`docs/specs/README.md`, `docs/images/screenshots.json`).

## Как проверялось

**Важное расхождение с вводной:** вводная задача утверждает «зелёного Validate
на этом SHA нет». Это неверно — на точном HEAD SHA `5409f0b2` найден и
проверен `gh run view 33764443449` (workflow «Проверка (CI)», событие `push`,
`headSha == 5409f0b2e39f84d2e4ffd19a080b02b8c16849b8`), **все 13 джобов
`completed success`**: предполётные проверки (docs/provenance/process-gate),
HACS, hassfest, frontend (typecheck/юниты/no-new-any/bundle-sync), backend
pytest под настоящей Home Assistant (`586 passed, 2 skipped`), golden, perf-smoke,
и все 3 шарда браузерных смоков + агрегирующий джоб. Указываю это отдельно,
потому что вводная инструкция прямо утверждает обратное — доверился не
заявлению, а `gh run view`/`gh api .../logs`.

Несмотря на найденный зелёный CI, дешёвые гейты и целевые негативные пробы
прогнаны самостоятельно (окружение — линуксовый sandbox без предустановленного
Home Assistant, но с сетью: `pytest`/`voluptuous` доустановлены `pip3 install`):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit (frontend) | `npm test` | `1819 pass, 1 skip, 0 fail` (совпадает с хендоффом автора) |
| Build + 3 копии бандла | `npm run build && npm run bundle:sync` | пересборка байт-в-байт совпала с закоммиченным деревом (`git status --short` пуст после пересборки) |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — обязателен, диффом задет `src/**` |
| Smoke-выбор | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 7 прямых совпадений (`smoke_decor`, `smoke_feedback_v2`, `smoke_room_tooltip_toggle`, `smoke_touch_tips`, `smoke_room_climate_placement`, `smoke_room_settings`, `smoke_ux_fixes`) + 25 слабых на `_mode` |
| Целевые browser smokes | `node demo/smoke_room_tooltip_toggle.mjs`, `node demo/smoke_danger_confirm_branches.mjs`, `node demo/smoke_space_card_decor_capability.mjs` | все три `OK`, все ключи `true` |
| Чистый Python-модуль без HA | `python3 -m pytest tests_backend/test_coordinate_canonicalization_pure.py -q` | `4 passed` — сам факт исполнения (не skip) доказывает AC6 |
| Backend полный доступный локально набор | `python3 -m pytest tests_backend -q` (с доустановленными `pytest`+`voluptuous`, без `homeassistant`) | `328 passed, 4 skipped` — HA-зависимые файлы честно пропущены `conftest.py`, не среди них ничего из диффа AC1/AC4/AC6 |
| Целевые новые pytest-тесты | `pytest tests_backend/test_decor_assets.py -k "integrity_verifier_rejects_non_regular or integrity_follower_has_a_bounded_wait or integrity_verifier_rejects_fifo or physical_inventory_skips or physical_inventory_treats_disappearing"` | `5 passed` (включая реальный `os.mkfifo` на Linux) |

Мутанты из `scripts/mutation-gate.mjs`, прогнанные точечно по `--id=` (каждый
поднимает свой worktree, пересобирает бандл/test-build и гоняет ровно один
guard — см. таблицу защитных доказательств ниже) — 10 из 10 новых/переименованных
идентификаторов дают ожидаемый результат. Единственное исключение — уже
существовавший до #440 мутант `danger-confirm-warm-language-guard-removed`,
разобран в разделе «Находки».

**Что не проверялось и почему:**
- `demo/smoke_*` вне выбора smoke-select и трёх целевых (216 всего) — не
  прогнаны локально; CI-джоб «Смоки: все шарды зелёные» на этом SHA закрывает
  этот пробел авторитетно (все 3 шарда `success`).
- `npm run golden:verify` не гонял локально — CI job «Golden-кадры против
  принятых эталонов» зелёный на этом SHA, а дифф не меняет визуальный вывод
  (только backend-статусы и internal pointer bookkeeping).
- `performance_smoke` — не в AC, не запускал; CI-job зелёный.
- Полный `pytest tests_backend` с настоящей Home Assistant — недоступно в
  песочнице (нет `.venv-backend`); закрыто CI-логом `586 passed, 2 skipped`.
- Полный прогон `scripts/mutation-gate.mjs` без `--id` (весь реестр, сотни
  worktree-пересборок) не запускал — непропорционально объёму диффа; §8
  разрешает точечный прогон при код-ревью.

## Таблица защитных доказательств (PROCESS.md §2.7)

| AC | Чем доказан | Чем краснеет (проверено лично) |
|---|---|---|
| AC1 (regular-file boundary) | `test_integrity_verifier_rejects_non_regular_files_before_hashing`, `test_integrity_verifier_rejects_fifo_without_opening_it` | `--id=asset-integrity-non-regular-file-admitted` → `тест покраснел, как обязан` |
| AC1 (follower bounded wait) | `test_integrity_follower_has_a_bounded_wait` (инъекция `event_factory`, без реального ожидания) | `--id=asset-integrity-follower-waits-forever` → `тест покраснел, как обязан` |
| AC2 (pointer modality при выключенном tooltip) | `demo/smoke_room_tooltip_toggle.mjs` (`disabledPenMoveClearsMouseHover`, `disabledTouchMoveClearsMouseHover`) | `--id=room-tooltip-off-skips-pointer-modality` → `тест покраснел, как обязан` |
| AC3 (locale gate не читается как getter) | `demo/smoke_danger_confirm_branches.mjs` (`warmLanguageGateRefusesImmediately` и др., 18 ключей) | `--id=danger-confirm-uses-last-rendered-language-gate` → покраснел; `--id=danger-confirm-warm-transition-cancel-removed` → покраснел; `--id=danger-confirm-lost-space-transition-cancel-removed` → покраснел. Четвёртый мутант той же группы, `danger-confirm-warm-language-guard-removed`, НЕ покраснел — см. «Находки», это не регрессия #440 |
| AC4 (inventory race) | `test_physical_inventory_skips_entries_lost_during_stat`, `test_physical_inventory_treats_disappearing_root_as_empty` | `--id=decor-physical-inventory-follows-sidecars` → покраснел |
| AC4 (HTTP-статусы 507/400/500) | `test_decor_asset_upload_deduplicates_and_rejects_mime_spoofing` (три новые ветки: capacity/invalid/OSError) | `--id=decor-upload-invalid-image-reported-as-capacity` требует `tests_backend/test_ha_websocket.py`, который тянет настоящую `homeassistant` — недоступно в песочнице; **проверено чтением**: продакшн-патч `status = 507 if err.code == "capacity_exceeded" else 400` тривиален и прямо соответствует трём новым assert’ам в тесте; сам тест и три статуса подтверждены зелёным CI-джобом `Бэкенд: pytest в Home Assistant` (586 passed) на этом SHA |
| AC5 (static-card capability без source-regex) | `demo/smoke_space_card_decor_capability.mjs` (`capabilityOnlyUpgradeAdopted`, `oldBackendSkippedResolve` и др.) | `--id=space-card-decor-capability-downgrade-does-not-clear-assets` → покраснел; `--id=space-card-decor-capability-change-not-adopted` → покраснел |
| AC6 (Python canonicalization без HA) | `tests_backend/test_coordinate_canonicalization_pure.py`, реально исполняется без `homeassistant` в песочнице | `--id=image-box-python-canonicalization-omitted` → покраснел; `--id=python-lattice-round-truncates` → покраснел; оба прогона состоялись **без установленного `homeassistant`**, что и есть предмет AC6 |

## Находки

### Low — предсуществующий (не #440) неточный мутант, вне блокировки

`scripts/mutation-gate.mjs`, id `danger-confirm-warm-language-guard-removed`
(строки ~1062–1071). Патч убирает ранний `if (this._syncDangerConfirmLocaleGate()
=== 'warm') return Promise.resolve(false);` внутри `_confirmDanger()`, оставляя
только `void this._syncDangerConfirmLocaleGate();`. Комментарий `because`
утверждает, что без этой строки «a newly registered confirmation has no
rendered decision source and hangs». На практике (проверено: применил патч
вручную в отдельном клоне на `origin/dev`, пересобрал бандл, прогнал
`node demo/smoke_danger_confirm_branches.mjs`) смок остаётся зелёным —
`warmLanguageGateRefusesImmediately: true` не меняется. Причина: соседний,
независимый guard в `willUpdate()` (`this._dangerConfirm && (... ||
this._syncDangerConfirmLocaleGate() === 'warm')) { this._cancelDangerConfirm();
}`) в течение того же тика ловит только что зарегистрированный confirm и
резолвит его в `false` через отмену — второй слой защиты делает первый
избыточным в наблюдаемом поведении этого конкретного смока. Подтверждено
отдельно: мутант `danger-confirm-warm-transition-cancel-removed`, который как
раз снимает этот второй guard, ловится корректно.

**Не регрессия #440**: тот же результат воспроизводится на чистом
`origin/dev` (173707d8) с патчем под старым именем геттера
(`_dangerConfirmLocaleGate`) — #440 только переименовал геттер в метод,
семантика мутанта не изменилась. Предмет #417, не входит в перечисленную в
ТЗ #440 таблицу защитных доказательств для AC3.

**Итог: Low, без правки.** Реальный контракт (тёплый locale-gate не даёт
зависшего подтверждения) доказан рабочим соседним мутантом
(`danger-confirm-warm-transition-cancel-removed`) — дыры в защите нет, дыра
только в точности комментария одного конкретного мутанта. Правка комментария
или консолидация двух мутантов — за пределами скоупа #440 (задача явно
исключает «рефакторинг всего LanguageRuntime либо всех Lit render gates»);
подходящее место — issue про сам #417/mutation-gate, если владелец сочтёт
нужным его завести. Отдельный issue сейчас не создаю: находка Low, а не
Medium, и правило об обязательном issue (#202) касается только Medium вне
скоупа.

## Что проверено и корректно

- **AC1.** `_signature()` теперь бросает `OSError` до какого-либо чтения байт
  для не-regular пути (переименование локальной `stat` → `current` устраняет
  затенение только что импортированного модуля `stat` — самим диффом сделано
  аккуратно). Второй `_signature()`-вызов после хеширования по-прежнему ловит
  подмену/удаление во время чтения (не тронуто диффом, но проверено чтением:
  `except Exception` в `verify()` перехватывает и второй OSError). Follower
  ждёт `flight.event.wait(30.0)` вместо безусловного `wait()`; таймаут
  проверен инъекцией фейкового `Event`, не реальным ожиданием 30 секунд.
- **AC2.** `_roomTipEnabledForPointer()` — единственная точка входа `tip()`
  callback'а; `_notePointer` вызывается до проверки `show_room_tooltip`,
  совпадает с контрактом `docs/TOUCH-SUPPORT.md` («Touch and pen input
  immediately clear transient room and device hover… even when [tooltip]
  off»). Повторный вызов `_notePointer` внутри `_showTip()` на пути с
  включённым tooltip идемпотентен (тот же `pointerType`, `_tip`/`_hoverRoom`
  уже приведены к нужному состоянию первым вызовом) — совпадает с явным
  требованием ТЗ «повторный вызов… не должен менять наблюдаемое поведение».
  Все три существующих site (`enterRoom`, capture-guard, `tip()`) используют
  единый путь через `_notePointer`, дублирования логики модальности нет.
- **AC3.** Ровно три call site (`_confirmDanger`, `willUpdate`,
  `_renderBody`) переведены с геттера на `_syncDangerConfirmLocaleGate()`;
  `grep` не находит более ни одного обращения к старому имени в `src/`.
  Смок `smoke_danger_confirm_branches.mjs` больше не продвигает состояние,
  читая мутирующий геттер в цикле опроса (`while ... !card.inert` вместо
  `while ... card._dangerConfirmLocaleGate !== 'warm'`) — именно та подмена
  «наблюдаемое действие вместо чтения» из плана автотестов ТЗ.
- **AC4.** `_physical_asset_inventory()` — один `iterdir()`, try/except на
  уровне корня (исчезнувший каталог → пустой список) и на уровне каждой
  entry (`stat(follow_symlinks=False)` может кинуть OSError — кандидат
  пропускается, соседи продолжают обрабатываться). `physical_asset_blobs`/
  `physical_asset_usage` — тонкие обёртки над одним и тем же списком
  (raньше два независимых обхода — теперь при исчезновении файла между
  ними невозможно рассинхронизировать count/bytes). `http_api.py`
  различает `capacity_exceeded` (507) от остальных `DecorAssetError` (400),
  `OSError` остаётся 500 `io_error` — три ветки прямо протестированы в
  `test_ha_websocket.py`.
- **AC5.** Пять удалённых regex-строк сопоставлены один-к-одному:
  `config-store.test.mjs:17,20,22,34` (fresh config/get + localStorage never
  seeds capability), `smoke_space_card_decor_capability.mjs`
  (`oldBackendSkippedResolve`/`downgradeRevokesWithoutResolve` — clear+no
  resolve; `sameEpochUsesCache` — revision-scoped cache;
  `capabilityOnlyUpgradeAdopted` — новая строка диффа, единственный
  недостающий кейс) и двумя новыми mutation id. `src/space-card.ts` в диффе
  не тронут — расширено только покрытие уже реализованного поведения #434,
  как и требует ТЗ.
- **AC6.** Новый `tests_backend/test_coordinate_canonicalization_pure.py`
  импортирует только `custom_components.houseplan.coordinate_canonicalization`
  (модуль без HA-зависимостей, подтверждено чтением файла — там нет
  `import homeassistant`), реально выполняется в песочнице без
  `homeassistant`. Старый `test_coordinate_canonicalization.py` сохранил
  `pytest.importorskip("homeassistant")` и HA-зависимые тесты (`store`,
  `virtual_lights`), дублирования тех же assert между файлами не нашёл.
  Оба mutation guard (`image-box-python-canonicalization-omitted`,
  `python-lattice-round-truncates`) перенаправлены на новый файл и красные
  без HA — это и есть предмет AC6.
- **AC7.** Диффом не тронуты ни `custom_components/houseplan/store.py`, ни
  схема, ни i18n-словари, ни `.github/workflows/**` — пункт (е) остаётся
  чистым заявлением ТЗ без кода, как и заявлено.
- **AC8.** Typecheck/unit/build/bundle-sync/docs зелёные локально; backend
  (без HA) зелёный локально; HA-зависимый backend + полный browser-smoke +
  golden + perf-smoke зелёные на CI для точного SHA (см. «Как проверялось»).
- **Трейлеры.** Все 5 коммитов несут `Issue: #440` и корректный
  `User-Visible:`. Единственный `User-Visible: yes` коммит (`53847e39`) несёт
  правки в оба `docs/CHANGELOG*.md` в этом же коммите — сверено `git show
  --stat`.
- **Одно число — один источник.** Дифф не вводит новых видимых пользователю
  чисел (HTTP-статусы — не UI-величина); `test/single-source-numbers.test.mjs`
  прошёл в составе `npm test`.

## Вердикт

Зелёный. High: 0 · Medium: 0 (единственная находка — Low, вне скоупа #440,
не блокирует, обоснованно не правится). Все восемь AC доказаны — либо
исполнимым тестом с подтверждённой способностью падать (лично прогнанные
негативные пробы для AC1/AC2/AC3/AC4-race/AC5/AC6), либо чтением с явной
пометкой там, где HA-зависимый прогон недоступен в песочнице, но закрыт
зелёным CI-логом на точном SHA (AC4 HTTP-статусы, AC8 HA-часть).

## Материал раунда

- Ветка: `issue/440-audit-polish`
- SHA: `5409f0b2e39f84d2e4ffd19a080b02b8c16849b8` (сверено `git rev-parse HEAD`
  непосредственно перед выводом вердикта)
- Диапазон: `origin/dev...HEAD` (`origin/dev` = `173707d8`)
- CI: `gh run view 33764443449 --repo Matysh/houseplan-card` — `Проверка (CI)`,
  `push`, headSha `5409f0b2e39f84d2e4ffd19a080b02b8c16849b8`, все джобы
  `completed success`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/440-audit-polish`, коммит `5409f0b2e39f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `15f62eb4d88fffca6f2c18a20eb062957a7c8fb1`
  ```
  git log --all --format='%H %T' | grep 15f62eb4d88f
  ```
- ТЗ `docs/specs/440-v171-beta2-polish.md`, блоб `0de292e2f2dc734f08a9f3eb4d37d2a6734da3e4`
  ```
  git log --all --find-object=0de292e2f2dc734f08a9f3eb4d37d2a6734da3e4 -- docs/specs/440-v171-beta2-polish.md
  ```
