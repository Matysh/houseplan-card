# Код-ревью — issue #1185, заход r1

Материал: `f89106fcca13486b7ee0acbcd31eb5cfacfe9076` (единственный коммит на
общем предке `72d99a77030c7f8947a64b88524d38712615c123` = v1.83.0 stable).
Трек: `show`. Класс изменения: инфраструктура (B/C, без A).

## Скоуп

Issue #1185 чинит гонку в офлайн-смоуке `demo/smoke_general_settings_form.mjs`:
проверка `toggleTargetsAre44` один раз покраснела в полном кандидате
(job 124835911721), потому что измерение `getBoundingClientRect()` ловило
дробную геометрию44×43.99998474121094px во время ещё не завершённого
180ms finite-enter перехода диалога General Settings. Задача не трогает
продукт — только момент измерения в тесте.

Изменённые файлы (все 4 из `changedFiles` прочитаны целиком и сверены
диффом `read:diff`):

- `demo/smoke_general_settings_form.mjs` — класс B;
- `docs/design/ui-kit-general-toggle-observer-1185.md` — класс C, новый;
- `docs/release-ledger/v1.83.0/1185.json` — класс C, новый;
- `scripts/ci-registry-inventory.json` — генерируемый D-артефакт (просто
  добавляет путь нового `1185.json` в два существующих списка `frontend`,
  без иных изменений).

## Независимый разбор

Дифф `smoke_general_settings_form.mjs` (проверено `read:diff` +
`read:base:...`, построчно):

1. Добавлен импорт `waitForUiKitPaint` из уже существующего
   `demo/helpers/ui-kit-paint.mjs` — сам хелпер **не изменён** (не входит
   в `changedFiles`); он уже используется в 12 других смоуках и
   `ui-lab`, включая принятый `smoke_card_controls.mjs` (#1182) для той
   же фактической проблемы дробной geometry при enter. Хелпер
   read-only: ждёт `document.fonts.ready`, затем до5раундов по2rAF и
   `Promise.allSettled` на конечных (не `Infinity`) анимациях с бюджетом
   4с на раунд; бесконечные анимации сцены не трогает, не подавляет
   motion.
2. Перед основным `page.evaluate` добавлен отдельный вызов, который
   открывает диалог ровно один раз (`c._openSettingsDialog();
   c.requestUpdate(); await window.__hpTest.settled();`) — это тот же
   самый код, что раньше выполнялся через локальный хелпер `upd()`
   внутри главного `evaluate`; дублирование неизбежно, так как
   Playwright `page.evaluate` — отдельный замыкаемый контекст, и `upd`
   недоступен снаружи. Затем следует `await waitForUiKitPaint(page)`.
3. Внутри основного `evaluate` строка `c._openSettingsDialog(); await
   upd();` **удалена** — открытие формы не дублируется (прямое чтение
   диффа подтверждает единственное открытие на весь сценарий до `d0`).
4. Ассерт `>=44` (`o.toggleTargetsAre44 = toggles.length >= 2 &&
   toggles.every(...b.width >= 44 && b.height >= 44)`) не тронут
   побайтно — только момент его исполнения сдвинут после устоявшейся
   отрисовки. Все остальные проверки формы (состав карточек, draft/
   save/cancel/reset, батарейные WS/revision/rollback) идут по тому же
   коду, что в базовой версии.
5. Нет фиксированного `sleep`, epsilon, tolerance, нового таймаута,
   browser pin или изменения анимации продукта — единственный новый
   source для времени это существующий `waitForUiKitPaint`.

`docs/release-ledger/v1.83.0/1185.json`: `category: "infra"`, без
`introducedBy` и без `visual` — корректно, задача не меняет ничего
видимого и не относится ни к одной ещё не выпущенной бета-фиче; формат
совпадает с соседними записями (`1183.json` и др.), `baseStable`
`v1.83.0` — действительно текущий предыдущий stable (`docs/CHANGELOG.md`
§v1.83.0 от2026-10-30, следующая запись — текущая `v1.84.0-beta.1`).

`scripts/ci-registry-inventory.json`: единственная дельта — путь нового
`docs/release-ledger/v1.83.0/1185.json` добавлен в два алфавитных
списка `frontend`; это ожидаемое следствие появления нового файла в
дереве, без иной логики.

## Чем доказан AC1 и чем он краснеет

AC1 требует: полный сценарий PASS, ассерты `>=44` не ослаблены, форма
не открывается дважды, нет зависимости от фиксированного sleep.

- **Чем краснеет** (негативный свидетель): исходный невидоизменённый
  продукт на материале перед правкой уже дал красный
  `toggleTargetsAre44` в полном кандидате —
  https://github.com/Matysh/houseplan-card/actions/runs/41302186631/job/124835911721
  (один RED в шарде1, остальные проверки того же сценария и других
  шардов PASS) — это обычный зарегистрированный отрицательный случай
  с командой/результатом, не мутация реализации.
- **Чем доказан**: я выполнил адресное исполнение **заново**, не
  полагаясь на цитируемый CI. Первый прогон упал по причине
  окружения (устаревший `demo/srv/assets/houseplan-card.js`,
  `Failed to fetch dynamically imported module` / `TimeoutError` в
  `launchInternal`, ещё до открытия диалога) — это не относится к
  правке, а к состоянию бандла в чек-окружении. После `build:bundle:sync`
  (`npm run build && node scripts/bundle-sync.mjs`, PASS) смоук выполнен
  заново: `smoke:demo/smoke_general_settings_form.mjs` → `exitCode:0`,
  `"toggleTargetsAre44": true`, все47проверок сценария `true`, финальная
  строка `OK`. Это новое фактическое исполнение на материале
  `f89106fcc`, не переиспользованный PASS.

Диалог открывается один раз — подтверждено построчным диффом (п.3
выше), а не только заявлением автора.

## AC2 (код/процесс/CI)

- Diff ограничен классами B/C/D, без правок `src/**`, fixtures,
  browser pins, epsilon/tolerance, анимаций продукта или baseline PNG —
  подтверждено `read:diff` целиком (единственные 4 файла).
- `waitForUiKitPaint` переиспользован без изменений — подтверждено
  отсутствием файла в `changedFiles` и grep по использованиям хелпера в
  demo/.
- `docs/release-ledger/v1.83.0/1185.json` против предыдущего stable —
  корректная классификация `infra`, обоснование соответствует
  фактической правке (см. выше).
- Трейлеры `Issue:`/`User-Visible:` коммита: доступные проверочные
  команды дают только `git log --oneline` для диапазона материала
  (`read:log` → `f89106fcc test: measure General Settings targets after
  finite enter paint`), без доступа к полному телу коммита — честная
  граница: напрямую текст трейлеров не прочитан. Косвенно это
  согласуется с остальным материалом: нет правок `docs/CHANGELOG.md`/
  `docs/CHANGELOG.ru.md` в `changedFiles`, что соответствует ожидаемому
  `User-Visible: no` для чисто инфраструктурной правки теста; push
  коммита физически проходит только через `.githooks` с проверкой
  трейлеров (`scripts/process-gate.mjs` / install-hooks), и хендофф
  сообщает «Process guard → PASS», а CI «tooling» этого материала —
  success. Подмены трейлеров не вижу, но саму строку не читал — это
  зафиксировано как «не проверял», не как находка.
- Авторское «НЕ сделано: первоначальный провал полного producer не
  объявляется PASS» корректно: сам факт провала job124835911721 не
  переобъявлен; proof строится на новом адресном исполнении.

## Трек show — критерии §5

complexity (1/10, риск1/10) — проходит; surfaces (один существующий
offline-смоук) — проходит; migration — нет; ux-contract — поведение не
меняется, новых контрактов нет; perf-touch — не затронуты; undocumented
— ожидаемое поведение полностью описано в самом issue (## ТЗ) и в новом
`docs/design/ui-kit-general-toggle-observer-1185.md`. Все критерии §5
пройдены → `route: fix`.

## Гейты: что прогнал и что нет

| Гейт | Результат | Основание |
|---|---|---|
| `read:diff`, `read:base:*`, `read:log` (статический разбор материала) | выполнено | адресное чтение диффа/лога, этот документ |
| `build:bundle:sync` (`npm run build && bundle-sync`) | PASS | требовалось для адресного запуска смоука на свежем бандле; переиспользовать было нечего — первый прогон упал по стале бандлу |
| `smoke:demo/smoke_general_settings_form.mjs` | PASS (после сборки), `toggleTargetsAre44: true`, все47 проверок `true` | адресная проверка именно AC1, единственный смоук, названный в AC |
| Validate-gate материала `f89106fcc` (product/tooling/docs) | green, переиспользовано | https://github.com/Matysh/houseplan-card/actions/runs/41305544938 — покрывает typecheck/build/обычный gate:small для этого материала, не повторял |
| `npm run gate:small` целиком, golden, `invariants`, `pytest tests_backend`, performance, HA-harness | не прогонял | дифф не трогает `src/**`, Python, геометрию модели или performance-контракт; это один офлайн-смоук теста, соразмерный гейт — именно он (докс/process/REVIEWER.md «Объём гейтов») |
| Трейлеры коммита (точный текст) | не прочитан напрямую | нет доступного check-примитива для полного тела коммита; зафиксировано как граница, не как находка (см. AC2) |

## Находки

High: 0. Medium в скоупе: 0. Побочных находок вне скоупа не обнаружено
(маршрут `mode=issues` по `REVIEW_FINDINGS_POLICY` — `outside_findings`
пуст).

## Что проверено и корректно

- Дублирования открытия формы нет; ассерты `>=44` и весь остальной
  сценарий (draft/save/cancel/reset, батарейные WS/revision/rollback)
  не изменены.
- Единственный общий хелпер `waitForUiKitPaint` переиспользован без
  изменений, без подавления motion и без фиксированных sleep/epsilon.
- `release-ledger` классификация `infra` относительно `v1.83.0`
  корректна и обоснована; генерируемый `ci-registry-inventory.json`
  обновился ожидаемо (только список путей).
- AC1 доказан свежим адресным исполнением смоука на материале ревью, а
  не чтением или переиспользованным PASS; негативный свидетель —
  реальный зарегистрированный RED исходного полного кандидата.

## Чего не проверял

- Полный текст коммитных трейлеров (`Issue:`/`User-Visible:`) — нет
  доступного примитива для чтения тела коммита; граница зафиксирована
  выше, находкой не считаю ввиду согласованности остального материала
  и зелёного tooling CI.
- Полные `gate:small`/golden/performance/pytest/invariants — не
  относятся к диффу (см. таблицу гейтов), предрелизный объём, не гейт
  ревью.
- Содержимое упомянутого в design-доке файла
  `output/general-toggle-diagnostic-measured.log` — это diagnostic-вывод
  автора вне продукта/тестов, не часть материала ревью.

## Маршрут

`route: fix` — задача проходит все критерии §5 трека show.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/CODE-REVIEW-1185-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImRiNzg2YmI4N2U5ZDA3MGNhMDY5YWIxYjlkM2U2ZDNmOWY4NmYyYWRhZTQ4OTIyMzUwMDQ5YzE3ZjE5ZjFkMjciLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0MTgyMDVmOGZkZGZmYjNhYjJjZjkxYTRlZWQ4YjRhYjEzNjE2MDY4NjUxODMwZDQxNWQyYmFkYWU4MGE4NGIyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTg1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJmODkxMDZmY2NhMTM0ODZiN2VlMGFjYmNkMzFlYjVjZmFjZmU5MDc2IiwidHJlZSI6IjA5MzZiNDVjZjhlNjc5MzY2NTBjZGJmNzA4MTFkZDhlNDMwM2RkODQiLCJib2R5RGlnZXN0IjoiZThiN2Y4YTk2YjQxNjNiMmZlMTEwMmExNDVlOWIzNTk1NzM4NDVlNjY4MzVhM2ZmMjk2MzRjYTlmZGJjNTM2YSIsInByb2R1Y2VyUnVuIjoiNDEzMDYxNTYyMjgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQ2NmU1NWZjYzVhN2Y0MWJlOGNjYzZhNDllMDM3YWMyNmQ2YjUyZWY5YTM0N2I0MzJkZjc4ZTA4YTAwODJlNmYiLCJ2ZXJkaWN0RGlnZXN0IjoiN2RiYTIzMzc3ZjljYmMwZTdkZGI1ZTE0MTg3ZTllMTkyZDUzOWE5ZTY1NDE4MmVjYmExNTY0OTFlOTFmZGJiNCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0ZDFiMDllNWYxZTFmMmY3NmIwOWU0YTgwMjRiODJkOWVkMGMyOGQzZmMzZWQxZmMxZWQ1YTg5ZjgyNzYyNjExIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTU3OTc4NDc3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTg1I2lzc3VlY29tbWVudC02NTU3OTc4NDc3IiwiYm9keURpZ2VzdCI6ImNjNDBmOWJkNjBhMzYzY2MzZTk1ODY3ZmI5MzQzZjlmYmQ2MjM1NGNhMzNjZGExNmU2NDQ2OTJjNzhjMGQwOWUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1185-general-settings-target-paint`, коммит `f89106fcca13` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0936b45cf8e67936650cdbf70811dd8e4303dd84`
  ```
  git log --all --format='%H %T' | grep 0936b45cf8e6
  ```
- Тело issue: `e8b7f8a96b4163b2fe1102a145e9b359573845e66835a3ff29634ca9fdbc536a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":41306156228,"run_attempt":1,"digest":"ea60d57e4ccfcd589d03645cd69bb93aaae4e09515f08e7d7548e978863e92cd"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjAsIm91dHB1dF90b2tlbnMiOjIwNTU5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMzQ5NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMwMjI5ODksImNvc3RVc2RFc3RpbWF0ZSI6MS4zNDQyOTE4MDAwMDAwMDAxfV0sInR1cm5zIjo0MywiZHVyYXRpb25NcyI6Mzc0ODEyLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zNDQyOTE4MDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=60 output_tokens=20559 cache_creation_input_tokens=133496 cache_read_input_tokens=3022989 num_turns=43 -->
