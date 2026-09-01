# CODE-REVIEW-43-r1

- Issue: [#43](https://github.com/Matysh/houseplan-card/issues/43) — Диалог помощи и обратной связи с обезличенным support report
- Ветка: `issue/43-help-feedback`
- SHA ревью: `1ba5363038055b3f3442b62a761161d05c6d03c7` (merge `origin/dev` в issue-ветку поверх `1e2e0fa6` — продуктовая реализация)
- Заход: r1 (первый код-ревью; ТЗ прошло 5 раундов ревью и зелёное, `S5-ready` → `S7-code-review`)
- Вердикт: **жёлтый** · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче

## 1. Скоуп

Диапазон `origin/dev...HEAD`: 71 файл, +7023/−411. Реализация ТЗ
`docs/specs/043-private-support-report.md` (ревизия 2, зелёное ревью r5):

- фронтенд: кнопка «Помощь и обратная связь» в шапке, новый диалог (перенос
  «О карточке», языковая ссылка на USER-GUIDE, форма отчёта, preview
  диагностического пакета) — `src/houseplan-card.ts`,
  `src/houseplan-editor-runtime.ts`, `src/support-feedback.ts`,
  `src/hp-dialog.ts`, `src/styles/*.ts`, `src/i18n/*.json`;
- backend: три websocket-команды `houseplan/support/{preview,preview/discard,submit}`,
  allowlist-проекция `support_package.py`, транспорт `support_transport.py`,
  константы в `const.py`;
- отдельный class-B сервис `scripts/support-relay/**` (написан и развёрнут на
  проектном стенде ещё во время цикла ТЗ, при закрытых DoR-зависимостях §17;
  это уже было предметом пяти раундов ревью ТЗ, включая живой пентест владельца
  на трассировке `X-Forwarded-For`);
- документация: `USER-GUIDE.{md,ru.md}`, `ARCHITECTURE.md`,
  новый `SUPPORT-PRIVACY.md`, `TESTING.md`, оба `CHANGELOG`.

Это первый код-ревью задачи — раунд полный, дельты по §2.10 нет.

## 2. Как проверялось

Ревью кода отвечает на вопрос «оно вообще работает» вместо ручного
тестирования (§2.7). Ниже — что выполнено лично, а не заявлено.

### 2.1 Дешёвые гейты (прогнаны лично, HEAD `1ba53630`)

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, 0 ошибок, 6.2 с |
| Юнит/интеграционные (frontend) | `npm test` | 1724 теста: 1723 passed, 1 skipped, 0 failed, 28.2 с |
| Сборка + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны; `npm run bundle:sync` не меняет рабочее дерево (`git status` чист) — все три копии (`dist`, `custom_components/.../frontend`, `demo/srv/assets`) уже синхронны в коммите |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | **красный** — 4 новых явных `any` без `// any-ok:` (находка Medium №3 ниже) |
| Docs-контракт | `node scripts/check-docs.mjs` | **красный** — `screenshot source fingerprint is stale` (находка Medium №1 ниже) |
| process-gate | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | «гейт пройден, предупреждений 0», 15 коммитов, включая проверку статуса issue через `gh` |

`check-docs` обязателен, потому что диапазон меняет `src/**`
(`houseplan-card.ts`, `houseplan-editor-runtime.ts`, `hp-dialog.ts`, оба
`styles/*.ts`, все 4 `i18n/*.json`) — правило §8 не оставляет выбора.
Проверено, что стойкость не унаследована из `dev`: тот же скрипт на чистом
`origin/dev` (отдельный worktree, `319b25c2`) даёт «Documentation checks passed
(7 files, 10 external links)» — значит, устаревание отпечатка порождено именно
этим диффом, а не фоновой работой #410.

### 2.2 Бэкенд Python (доступность харнесса)

Локальный образ ревьюера без `.venv-backend` (как и описанный в `AGENTS.md`
случай «Local Windows checkout»). Установил недостающие пакеты вручную, чтобы
не оставлять этот участок полностью непроверенным:

- `pip install pytest voluptuous aiohttp pytest-asyncio homeassistant` (без
  пина) → `tests_backend/test_support_package.py`: **10 passed** (модуль
  `support_package.py` намеренно не импортирует HA, тест не нуждается в
  харнессе); `tests_backend/test_ha_support_transport.py`: **7 passed** (этому
  файлу тоже хватает голого `homeassistant.helpers.aiohttp_client`, харнесс
  `pytest-homeassistant-custom-component` не нужен).
- `pip install pytest-homeassistant-custom-component` (снова без пина; CI пинует
  `homeassistant==2026.8.3` + `phcc==0.13.357` под Python 3.14, здесь только
  3.12) → резолвер подобрал несовместимую пару, `python -m pytest
  tests_backend -q` дал **96 failed / 387 passed** по всему `test_ha_*.py`,
  включая файлы, никак не связанные с #43 (`test_ha_upload.py`,
  `test_ha_virtual_lights.py`). Это диагностика рассинхронизации версий
  харнесса, а не регрессия диффа — **результат не используется как
  доказательство ни в одну сторону**. Четыре support-специфичных теста в
  `test_ha_websocket.py` (`test_support_preview_is_authorized_exact_and_consumed_only_after_success`,
  `test_support_preview_replacement_and_discard_are_draft_local`,
  `test_support_text_only_submit_carries_safe_versions_without_plan_data`,
  `test_support_commands_reject_read_only_user_before_build_or_transport`,
  `test_support_preview_schema_does_not_coerce_client_facts[...]`) упали той же
  генерической `assert False`, что и заведомо исправные несвязанные тесты —
  подтверждает, что причина в среде, не в тесте.
- Итог: полный HA-харнесс в этом ревью не поднят (нет Python 3.14 в песочнице,
  тянуть его ради одного прогона — непропорциональная трата времени). Авторский
  хендофф в issue называет точные числа с зелёными прогонами на его машине
  (`privacy/backend targeted — 15 passed`, `support relay — 36 passed`) —
  доверяю числу для support_package.py/support_transport.py (сам перепроверил,
  совпадает — 10+7=17, близко к заявленным 15 при другом подсчёте узкого
  таргета), но для `test_ha_websocket.py` авторские числа не перепроверены
  исполнением. Соответствующие AC (AC9, AC10) закрыты ниже пометкой «проверено
  чтением, не исполнением», не автотестом с моей стороны.

### 2.3 Relay (`scripts/support-relay/**`)

`python3 -m unittest discover -s scripts/support-relay/tests -q` → **36
passed** (тот же набор, что и в последнем зелёном спек-ревью r5; код `hp_relay/**`
этим диапазоном не менялся — сверено `git diff origin/dev...HEAD --
scripts/support-relay/hp_relay` вместе с диапазоном коммитов истории: relay был
написан и вычитан во время цикла ТЗ пятью раундами ревью, включая живой пентест
владельца против подмены `X-Forwarded-For`). Прочитал код заново (не как
унаследованное, а как часть этого код-ревью — предмет здесь другой гейт,
код-ревью, а не спек-ревью):

- `hp_relay/app.py:147-158` — источник rate-limit берётся из последнего
  элемента `X-Forwarded-For` только при `trusted_proxy=True` (default),
  иначе — адрес TCP-соединения; совпадает с `scripts/support-relay/deploy/Caddyfile.fragment`
  (`header_up X-Forwarded-For {remote_host}` — заголовок перезаписывается
  целиком на обоих продовых сайтах).
- `hp_relay/delivery.py` — оба канала (`TelegramDelivery`, `HaWebhookDelivery`)
  не используют `parse_mode`, то есть Telegram показывает текст пользователя
  буквально; ответ провайдера не отражается наружу и не попадает в HTTP-ответ
  клиенту (`app.py` мапит статус на закрытый список кодов).
- `hp_relay/app.py` — единственный лог-метод (`log_message`) переопределён и не
  печатает адрес источника, только команду и путь.

Отдельно нашёл несостыковку единиц измерения в конфигурации прокси (находка
Low №4 ниже) — не блокирует, эффекта на легитимный трафик не имеет по расчёту.

### 2.4 Смоки и golden

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` печатает ~40
существующих смоков — все совпадают по диффу через уже существующие символы
(`_config`, `_editorRuntime`, `_infoCard`, `_markerDialog`), ни один не создан и
не изменён этим диффом. `ls demo/smoke_*.mjs | grep -iE "support|help|feedback"`
находит `smoke_feedback_v2.mjs` и `smoke_help_affordance.mjs` — оба
существовали в `origin/dev` до этой ветки и относятся к issue #68 (контекстная
помощь `hp-help`/`.rlgearbtn`), никак не к диалогу #43. **Ни один существующий,
ни один новый браузерный смок не касается нового диалога, кнопки или формы.**
`git diff --stat origin/dev...HEAD -- demo/` — пусто; `-- demo/golden` — пусто.
Причина находки Medium №2 ниже.

### 2.5 Инварианты модели

Не прогонял `npm run invariants -- --config <...>`. Диапазон не меняет ни
`validation.py`, ни модуль геометрии/толщины стен, ни схему `layout` (сверено
`git diff --stat` — `custom_components/houseplan/{diagnostics,import_export,validation}.py`
не тронуты). `support_package.py` только **читает** уже провалидированные
config/layout под тем же `write_lock` и строит отдельный allowlist-объект;
ничего не пишет обратно в хранимую модель. Инварианты о ключах записи толщины и
разрешимости ссылок относятся к хранимой модели, а не к экспортному снапшоту —
гейт не по предмету этого диффа, не «пропущен», а не применим.

### 2.6 Одно число — один источник

Проследил цепочку preview: backend строит `bytes`/`sha256`/`size` один раз в
`ws_support_preview` (`websocket_api.py:2153-2221`), кладёт в
`rt.support_previews[token]` и больше не пересчитывает — submit
(`websocket_api.py:2260-2312`) берёт `preview.get("bytes")`/`preview.get("sha256")`
из того же токена, никогда не перестраивая пакет. На фронтенде
`_buildSupportPreview` (`houseplan-editor-runtime.ts:9193-9250`) сверяет
`response.size` с независимо посчитанным `TextEncoder().encode(text).byteLength`
и падает в `support_rejected` при расхождении, затем кладёт результат в один
`SupportPreview`-объект (`support-feedback.ts:6-16`), который читают бейдж
размера, строка SHA-256, `<textarea>` с сырым JSON и кнопка Download
(`_downloadSupportPreview`) — везде один и тот же объект, ни одного второго
независимого вычисления не найдено. Единственное число, которое пользователь
видит дважды (preview vs отправленное), доказуемо имеет один источник по обе
стороны границы.

## 3. Разбор по AC (§13 ТЗ)

Обозначения: **PASS/тест** — автотест, который умеет падать (проверил сам или
логикой теста); **PASS/чтение** — проверено чтением кода, не исполнением;
**UNVERIFIED** — ни то, ни другое в этом ревью.

| AC | Итог | Свидетельство |
|---|---|---|
| AC1 | PASS/чтение | `houseplan-card.ts` — кнопка Help делит тот же `_norm && _canEdit` блок и kiosk-класс, что и General Settings; порядок в DOM (zoom → settings → help) совпадает с `test/support-feedback.test.mjs`. Открытие — только `newSupportDialogState()`, ни один mode/zoom/selection не трогается. **Браузерного смока с реальным View/тремя редакторами/kiosk-негативом, который спек называет доказательством, нет** — см. находку Medium №2 |
| AC2 | PASS/тест+чтение | `gs.about_group`/`about_version`/`github`/`telegram` перенесены ровно один раз (`test/support-feedback.test.mjs`, счётчик вхождений); маршрутизация RU→RU/остальное→EN подтверждена чтением (`houseplan-editor-runtime.ts:9360-9363`) и юнит-тестом |
| AC3 | PASS/тест | `support-feedback.ts` — `supportDraftError`, code-point-точная длина (тест на эмодзи), чекбокс всегда `false` при новом открытии, не сохраняется |
| AC4 | PASS/чтение | Текст предупреждения называет точную геометрию явно; открытие диалога не делает сетевых вызовов; включение чекбокса вызывает **только внутренний** `houseplan/support/preview` (это и есть контракт §6.4/§9.3 — «preview не трогает внешний relay»), внешний relay достижим только из `submit` |
| AC5 | PASS/тест | Backend никогда не перестраивает пакет на submit (`preview.get("bytes")`); `test_support_package.py` доказывает детерминизм байт/хеша; фронтенд сверяет присланный `size` с независимым подсчётом байт текста |
| AC6 | PASS/тест+чтение | Каждая `_project_*`-функция в `support_package.py` строит новый `dict` по allowlist полей, ни разу не мутируя исходный `config`/`layout` (`grep` по файлу не находит `config[...] =`/`.pop`); `test_geometry_and_references_survive_with_package_local_pseudonyms` проверяет разрешимость ссылок после ремаппинга |
| AC7 | PASS/тест (с оговоркой) | `test_privacy_projection_never_contains_raw_or_encoded_forbidden_values` сеет sentinel в каждое запрещённое поле, включая неизвестные вложенные ключи, и проверяет отсутствие verbatim/JSON-escaped/base64. **Путь `_support_repairs()` (реальное чтение HA issue registry, `websocket_api.py:244-253`) этим тестом не задет** — тест кормит `build_support_package` уже готовым списком `repairs`, минуя чтение реестра. Прочитал функцию: она физически не может вернуть ничего, кроме `{"code": "broken_plan", "count": N}}` (raw `issue_id`/`space_id` нигде не покидают функцию) — оцениваю PASS по чтению для этого конкретного пути, но замечаю расхождение с §14.1, который явно требует sentinel-фикстуру именно для `broken_plan_<spaceId>` |
| AC8 | PASS/тест | Тот же sentinel-тест сеет неизвестные top-level и вложенные ключи — allowlist «строит новое», а не «копирует и чистит», поэтому регрессия к redaction-after-copy была бы поймана |
| AC9 | PASS/чтение (частично тест) | `_check_write`/`may_write` на всех трёх командах, тест на read-only пользователя (`test_support_commands_reject_read_only_user_before_build_or_transport`) зелёный по чтению кода (харнесс не поднят — см. §2.2). Проверка владения токеном (`preview.get("owner") != _connection_user_id(...)`) в discard/submit простая и однозначная по чтению; **межпользовательского теста (два `can_write`-пользователя, один не видит чужой токен) в кодовой базе нет**, хотя у соседней фичи (import-preview) есть точно такой паттерн теста. Не блокирую отдельно — логика идентична уже проверенному паттерну соседней фичи, но фиксирую пробел |
| AC10 | PASS/чтение | Submit никогда не перечитывает config/layout — структурная гарантия, а не только тестовая. Замена/discard токена — тест зелёный (по чтению, харнесс не поднят). **TTL 10 минут ни один тест не проверяет fake-clock** (для аналогичной import-preview фичи такой тест есть: `runtime.import_previews[token]["expires"] = 0`), хотя АС в ТЗ явно обещает «Fake-clock backend tests». Код (`preview["expires"] <= time.monotonic()`) простой, оцениваю PASS по чтению |
| AC11 | PASS/тест | `support_transport.py` — HTTPS/фиксированный хост/без редиректов/таймауты 5/20с, статус мапится на закрытый список кодов **до** чтения тела (413 отрабатывает корректно независимо от того, кто вернул этот статус — сам relay или проксирующий Caddy), ответ ограничен 4097 байт и не отражается. `test_transport_uses_only_fixed_https_host_without_redirects`, `test_transport_maps_remote_status_without_reflecting_response`, `test_transport_rejects_unbounded_or_invalid_receipt` — все зелёные (запустил сам, §2.2). Отсутствие логирования message/contact подтверждено `grep`-ом по файлу (0 вызовов логгера) — чтением, не `caplog`-тестом |
| AC12 / AC12a | PASS/тест | 36/36 в `scripts/support-relay/tests`, включая `test_client_cannot_pick_its_own_rate_bucket` и `test_direct_node_ignores_the_forwarded_header` — оба уже мутационно доказаны в спек-ревью r3-r5, код с тех пор не менялся |
| AC13 | PASS/чтение | Успех не закрывает диалог, показывает id + Copy; ошибка сохраняет черновик, предлагает Retry/Download/ссылки. **Браузерного смока success/429/timeout, который спек называет доказательством, нет** — см. Medium №2 |
| AC14 | PASS/чтение, UNVERIFIED по заявленному способу доказательства | 44×44 CSS px, media-запрос на 320px, `aria-describedby`, управление фокусом — всё присутствует в источнике. **Спек требует «Reviewed desktop + phone + tablet goldens and touch smoke» — этого артефакта нет вообще** (см. Medium №2). Реальный рендер в браузере (фактические вычисленные размеры, фокус в настоящем DOM, реакция на нажатие Tab) статическим чтением TS не доказывается |
| AC15 | PASS/чтение | `diagnostics.py`, `import_export.py`, `validation.py` — 0 изменений в диапазоне (`git diff --stat`) |
| AC16 | PASS/чтение+прод-эксплуатация | Секрета в `custom_components/**` нет, только `SUPPORT_RELAY_URL`-константа; issue-хендоффы фиксируют реальный health-check прод/staging, ретеншн-таймеры на стенде |
| AC17 | PASS/чтение (frontend), UNVERIFIED (backend perf) | Фронтенд: `SupportDialogState`-тип импортируется как type-only, реальный код лежит в существующем lazy-чанке редактора — нового eager-импорта нет. **Backend perf-бюджет (≤750 мс/≤24 MiB на максимальный конфиг) не имеет ни одного бенчмарк-теста** — спек называет «Backend benchmark/limit test» явно, в кодовой базе такого теста нет вовсе. `MAX_SUPPORT_ATTACHMENT_BYTES` (8 MiB) проверен по коду (`support_package.py:494`), но не тестом на реальном превышении размера |

## 4. Находки

### Medium (в скоупе #43, чинится в этой же задаче)

**M1. `check-docs` красный на этом SHA — устаревший отпечаток скриншотов документации.**

`node scripts/check-docs.mjs` → `ERROR screenshot source fingerprint is stale;
run npm run build && node demo/docs/capture.mjs`. Подтверждено, что это не
фоновый шум: тот же скрипт на чистом `origin/dev` (`319b25c2`, отдельный
worktree) даёт «Documentation checks passed». Причина механическая и полностью
предсказуемая по `AGENTS.md`/`PROCESS.md` §8: `docs/images/screenshots.json`
хранит `sourceFingerprint: 7faa6c2e…`, а актуальный `visualFingerprint(src/**)`
на HEAD — `d300613d…`; диапазон меняет `houseplan-card.ts`,
`houseplan-editor-runtime.ts`, оба `styles/*.ts` — любая из этих правок делает
отпечаток устаревшим, «выбирать тут нечего». Job `docs` в `validate.yml`
запускает ровно эту же команду (`--external`) — CI на этом SHA покраснеет
именно там, повторяя сценарий #230/#234/#237 (там же `dev` простоял с красным
`docs` до следующей задачи). Фикс — пересъёмка (`npm run build && node
demo/docs/capture.mjs`), либо, если требуется байт-в-байт воспроизводимость
между окружениями (`docs:accept --reviewed --from=<CI-артефакт>`), прогон job
`Docs screenshots` (`workflow_dispatch`) с последующей приёмкой. Ни то, ни
другое ревьюер делать не вправе (не правит продуктовый код/сгенерированное).

### M2. Ни одного браузерного теста или golden-сцены для всего диалога Help & Feedback.

`git diff --stat origin/dev...HEAD -- demo/` и `-- demo/golden` — пусто.
`node scripts/smoke-select.mjs --base origin/dev --head HEAD` называет ~40
смоков, отобранных по совпадению с уже существующими символами
(`_config`, `_editorRuntime`, `_infoCard`, `_markerDialog`) — ни один не
упоминает новую кнопку, диалог или форму, потому что символы `_openSupportDialog`,
`_submitSupport`, `_renderSupportDialog` не встречаются ни в одном смоке
репозитория. Единственные тематически похожие файлы,
`demo/smoke_feedback_v2.mjs` и `demo/smoke_help_affordance.mjs`, существовали в
`origin/dev` до этой ветки и относятся к неродственной фиче #68 (контекстная
подсказка `hp-help`, кнопка `.rlgearbtn`) — совпадение имён случайное.

Это не абстрактная придирка к процессу, а прямое расхождение с самим ТЗ,
которое прошло пять раундов ревью именно ради точности доказательств:

- §13 AC1: «Browser smoke in View + three editors + kiosk/unauthorized negatives»;
- §13 AC13: «Browser smoke across success/429/timeout/unknown command»;
- §13 AC14: «Reviewed desktop + phone + tablet goldens and touch smoke»;
- §14.2 явно перечисляет golden-сцены («desktop no attachment, desktop preview,
  phone validation error, phone success, relay error/manual recovery, light and
  dark themes»);
- §14.4 (обязательные мутации): «success shown on timeout → browser smoke red» —
  без единого браузерного теста эта мутация физически некому ловить.

Прочитанный код (см. §3 таблицы AC1/AC13/AC14) выглядит корректным, и я
принимаю его как «проверено чтением» для логики. Но именно то, что чтением
принципиально не доказывается — реальный вычисленный размер тач-таргета в
браузере, фактическое поведение фокуса/ARIA при настоящем Tab/Escape, реальная
раскладка при ширине 320px, экранные состояния success/429/timeout — эта фича
вводит новую диалоговую поверхность с уникально строгим touch-контрактом
(единственное явное исключение из «редакторы desktop-first» во всём проекте) и
не имеет вообще никакого доказательства на этом уровне. Ручного тестирования в
процессе нет по конструкции — это тем более причина не оставлять единственный
уровень, который ловит браузерные дефекты, полностью пустым для новой
поверхности.

### M3. Новый явный `any` без обоснования — 4 вхождения, гейт `no-new-any` красный.

`node scripts/no-new-any.mjs --base origin/dev --head HEAD`:

```
src/houseplan-editor-runtime.ts:9199 — const response: any = await this.host.hass.callWS({...})   (preview)
src/houseplan-editor-runtime.ts:9317 — const response: any = await this.host.hass.callWS({...})   (submit)
src/support-feedback.ts:124          — options.language as any
src/support-feedback.ts:141          — (value as any).code
```

Ни на одной строке нет `// any-ok: <причина>`, как того явно требует §8. Все
четыре — не случай «тип недоступен»: формы WS-ответов полностью описаны в §8.1
и §8.3 ТЗ (`{token, expires_in, size, sha256, spaces, format, version, text}`
и `{report_id}`), их можно типизировать интерфейсом; `options.language as any`
используется только для проверки членства в `readonly ['en','ru','de','fr']` —
идиоматично решается через `(LANGS as readonly string[]).includes(...)` без
приведения аргумента к `any`; `(value as any).code` — тривиально
`(value as Record<string, unknown>).code`. Гейт создан именно для этого класса
случаев (issue #342): новый код не должен по умолчанию расширять долг в 1034
уже существующих `any`.

### Low (снимается с записью, не блокирует)

**L1.** `scripts/support-relay/deploy/Caddyfile.fragment`: `request_body {
max_size 8.7MB }` — Caddy парсит `MB` как десятичные байты (8 700 000), а
собственный лимит relay `MAX_REQUEST_BYTES = 8 * 1024*1024 + 512*1024` — это
8.5 **MiB** (8 912 896 байт). То есть внешний прокси-лимит на ~213 КБ **меньше**
внутреннего, хотя по комментарию в `config.py` («вложение ≤ 8 MiB, весь запрос
≤ 8.5 MiB») задумывался запас, а не сужение. Эффекта на легитимный трафик нет:
`support_package.py` отклоняет пакет ещё в HA до отправки, если он больше ровно
8 MiB (`MAX_SUPPORT_ATTACHMENT_BYTES`), так что реальный исходящий запрос —
максимум ~8.0-8.1 MiB, с запасом ниже обеих границ; и даже гипотетический
прямой запрос к публичному эндпоинту, упёршийся в Caddy раньше, чем в
`app.py`, получит тот же HTTP 413, который `support_transport.py` мапит на
`support_package_too_large` по коду статуса, а не по телу ответа. Стоит
поправить директиву на явно бо́льшее значение (например, `9MB` или
`9437184`) при следующей правке деплоя — путаница decimal/binary единиц имеет
свойство накапливаться.

**L2.** `custom_components/houseplan/websocket_api.py`, `ws_support_preview`:
дорогая сборка снимка (`await hass.async_add_executor_job(_build_snapshot)`,
бюджет до 750 мс/24 MiB) выполняется **до** проверки
`MAX_SUPPORT_PREVIEWS_PER_USER`/`_TOTAL` (строки 2180 → 2194-2196). Уже
авторизованный (`can_write`) пользователь с 3 живыми превью может повторно
дёргать `houseplan/support/preview`, каждый раз оплачивая полную стоимость
сборки, и только после этого получать `support_rate_limited` — лимит защищает
только хранимое состояние, не CPU. Блокирующим не считаю: действующее лицо уже
прошло авторизацию записи (доверенная роль admin/`can_write`, не анонимный
интернет), итоговый инвариант «не больше 3 сохранённых превью» не нарушается.

**L3.** `_support_repairs()` (`websocket_api.py:244-253`, новая функция) не
покрыта ни одним тестом — §14.1 явно называет «sentinel fixture including
`broken_plan_<spaceId>` Repair normalization» в плане тестов, а
`test_support_package.py` подаёт `repairs=[...]` в `build_support_package`
напрямую, минуя чтение реестра. Прочитал функцию — она физически не может
вернуть ничего, кроме `{"code": "broken_plan", "count": N}` (raw `issue_id`
нигде не покидает функцию, кроме как через `.startswith()`-проверку), поэтому
не блокирую, но фиксирую расхождение с собственным тест-планом ТЗ.

**L4.** `test/support-feedback.test.mjs` и весь diff добавляют
`backup.error.support_invalid_message`/`support_package_too_large`/
`support_preview_expired`/`support_rate_limited`/`support_rejected`/
`support_unavailable` в namespace `backup.error.*` во всех 4 локалях
(`src/i18n/en.json:1132-1137` и параллельно в `ru/de/fr.json`), но ни разу их
не читает — реальные ошибки диалога идут через `support.error.*`
(`_supportErrorText`, `houseplan-editor-runtime.ts:9345-9351`). Функционально
безвредно (просто неиспользуемые переводы), но может ввести в заблуждение
следующего читателя, решившего, что backup-flow умеет показывать
support-ошибки. Можно удалить точечной правкой.

## 5. Что проверено и корректно (без замечаний)

- Allowlist-проекция `support_package.py`: каждая `_project_*`-функция строит
  новый `dict` полем за полем, ни разу не сериализуя и не мутируя исходный
  `config`/`layout` — структурная гарантия §7.3 выполнена буквально, не только
  по духу.
- Авторизация: все три WS-команды используют тот же `_check_write`/`may_write`,
  что и остальные write-команды интеграции; владение токеном проверяется в
  discard и submit.
- Пседонимизация: пространство имён случайное на каждый preview
  (`secrets.token_hex(4)`), не хранится и не возвращается клиенту; неизвестные
  ключи `layout` отбрасываются fail-closed (`_project_layout`), а не
  копируются.
- Транспорт: фиксированный compile-time HTTPS-хост, редиректы отключены,
  таймауты 5/20с, ответ ограничен и не отражается, статусы мапятся на закрытый
  список кодов независимо от тела ответа.
- Relay: `X-Forwarded-For` берётся из последнего элемента только при
  `trusted_proxy=True` (и запрещён к выключению за прокси текстом ТЗ и
  deploy-README); оба канала доставки не используют `parse_mode`, поэтому
  пользовательский текст не может быть разметкой; 36/36 тестов зелёные, три из
  них — специально проверенные владельцем и ревьюером ТЗ мутационные гварды
  (XFF spoofing, direct-node XFF-ignore, вебхук прикладывает вложение).
  Изменений в этом коде текущим диапазоном нет — унаследовано с зелёного
  спек-ревью r5 (SHA `3ce5bc0e`), но перепрочитано заново как часть этого,
  первого код-ревью, а не принято на веру.
- «Одно число — один источник» для preview/download/submit: единственный
  расчёт байт/хеша на backend, единственный кешированный объект на фронтенде;
  см. §2.6.
- Трейлеры и changelog: `1e2e0fa6` несёт `Issue: #43` + `User-Visible: yes` с
  правками в обоих changelog в том же коммите; merge-коммит `1ba53630` —
  `User-Visible: no`, корректно. `process-gate --issues` зелёный.
- AC15 (отсутствие побочного влияния на diagnostics/backup/#295): 0 изменений
  в `diagnostics.py`/`import_export.py`/`validation.py`.
- Деградация на старом backend: `compatible = this.host._haIntegrationVersion
  === CARD_VERSION` закрывает форму отдельным `supportupdate`-блоком, About/Guide
  остаются доступны — совпадает с §10 ТЗ.
- `scripts/process-gate.mjs::classify('scripts/support-relay/...')` → `'B'`,
  подтверждено и regression-тестом (`test/process-gate.test.mjs`, новый кейс
  «#43»), и живым прогоном — Medium-находка спек-ревью r1 закрыта на уровне
  файловой раскладки, а не только текста ТЗ.

## 6. Чего не проверял и почему

- **Полный HA-харнесс** (`test_ha_websocket.py` целиком, `test_ha_import_export.py`
  и т.д.) — песочница ревьюера не имеет Python 3.14/`pytest-homeassistant-custom-component==0.13.357`
  (пин CI), а неверсионированная установка дала диагностически бессмысленный
  результат (96 несвязанных провалов). AC9/AC10 закрыты пометкой «проверено
  чтением», не автотестом с моей стороны — см. §2.2 и таблицу AC.
- **`npm run invariants`** — диапазон не меняет хранимую геометрическую модель
  (`validation.py` и модуль стен/толщины не тронуты), только читает её для
  экспорта; гейт не по предмету, не пропуск.
- **`npm run golden:verify`** — golden-сцен для этой фичи не существует вообще
  (см. находку M2); верифицировать нечего, сама находка это фиксирует.
- **Полный набор `demo/smoke_*.mjs`** — предрелизная обязанность (§8), к тому
  же ни один существующий смок не относится к этой фиче (см. §2.4); прогон
  всех ничего не доказал бы для этого диффа.
- **Числа из хендоффа автора** (`npm test — 1723 passed`, `support relay — 36
  passed`) — перепроверены лично и совпадают. Число `privacy/backend targeted
  — 15 passed` не совпадает буквально с личным подсчётом (10+7=17 на моей
  урезанной установке пакетов) — возможно, иной набор `-k`; не рассматриваю
  как расхождение, потому что оба набора, которые смог прогнать сам, зелёные.

## 7. Итог

Функциональность реализована добросовестно и соответствует зелёному, пять раз
провалидированному ТЗ по всем 17 AC на уровне логики: allowlist строится по
белому списку, а не редактированием копии; авторизация и владение токеном
корректны; transport и relay воспроизводят все инварианты, за которые
владелец лично поручился пентестом. Ни одной High-находки — architecture
привacy-границы не нарушена нигде, где я мог её проверить.

Три Medium-находки удерживают вердикт жёлтым, и все три — предметные, не
формальные: красный `check-docs` гарантированно красит CI на этом же SHA
(проверено сравнением с `origin/dev`), гейт `no-new-any` красный без единого
обоснования, а вся браузерная часть контракта (кнопка, тач-таргет, формы,
golden-сцены), которую само ТЗ называет способом доказательства четырёх AC,
не имеет вообще никакого покрытия на этом уровне. Все три чинятся в рамках
текущей задачи без изменения контракта.

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче
