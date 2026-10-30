Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/CODE-REVIEW-1089-r2.md

# Код-ревью #1089 — контекстное меню устройства в Просмотре (r2)

## Материал

SHA `0dd219b03c5f290ca7c94c4181c5d6bde051de87` (рабочая копия уже на нём, подтверждено `gitStatus`). `read:log` (run_check) подтверждает диапазон и показывает ровно два коммита после материала r1 (`f4cc0bd54`): `761596a29 docs: review document for #1089` (публикация отчёта r1, механический коммит) и `0dd219b03 docs: distinguish View context menu from saved settings action (#1089)` — единственное авторское исправление этого раунда. Трек `ask`, маршрут вердикта — `fix` (задан пакетом).

Core user job по SCOPE.md: J3 («Let me act on the obvious right from the plan») — меню даёт доступ к действиям устройства прямо с плана в Просмотре; J6 косвенно (Delete/Hide переиспользуют существующие операции редактирования модели).

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| M1 — `docs/UX-MODES.md:252-254` описывал заменённое поведение #1050 («The saved Device settings action and right click in View open that same device editor... (#1050)») как действующее, противореча верхнему баннеру того же файла (строка 3) и реализации | Коммит `0dd219b03`, абзац переформулирован: «The saved **Device settings** action opens that same device editor without changing mode (#1050)... In ordinary View, right click instead opens the shared five-command device menu (#1089); its Device settings item opens the same editor and is disabled for read-only users. Kiosk retains its permission hint without opening the menu.» | `docs/UX-MODES.md:252-258` (текущее состояние, прочитано напрямую); hunk подтверждён `read:diff` (строки 740-757 вывода проверки) — замена абзаца 744-747 → 748-754, верхний баннер (строка 3, добавлен в `f4cc0bd54`) не тронут и остался согласован |

Проверено независимо, не только по утверждению автора: прочитан текущий `docs/UX-MODES.md` целиком вокруг обоих абзацев (верх и строки ~248-267) — формулировки теперь согласованы между собой и с `TOUCH-SUPPORT.md:117-123`, `DEVICE-PRESENTATION.md:638-641`, `ARCHITECTURE.md:170-180`, `DEVELOPMENT.md:359-380`, `USER-GUIDE.md:1734,1824-1831`. Дополнительно выполнен адресный поиск (`Grep`, не ограничиваясь утверждением автора) по `right.?click|right click|#1050` в `UX-MODES.md, TOUCH-SUPPORT.md, DEVICE-PRESENTATION.md, ARCHITECTURE.md, USER-GUIDE.md, USER-GUIDE.ru.md, STATUS.md, DEVELOPMENT.md` и по `ПКМ|прав.{0,3}клик` в `USER-GUIDE.ru.md, UX-MODES.md` — других мест, где View ПКМ описан как прямой вход в редактор (минуя меню #1089), не найдено; все совпадения либо про #1089-меню, либо про исторический BEFORE-срез `DEVELOPMENT.md:374-376` (явно помечен «immutable ordinary BEFORE», не текущее поведение), либо про несвязанные правые клики (структурные узлы Plan, Devices-меню, intermediate node). AC12 ТЗ («Документы описывают замену только View ПКМ») выполнен.

`read:diff` также подтверждает, что `0dd219b03` — единственный новый содержательный коммит: diff dev→кандидат не содержит изменений ни в одном `src/*.ts`/`test/*.mjs` файле сверх того, что уже было на материале r1 (сверено построчно по списку `diff --git` — 73 файла, тот же состав, что в r1, без новых продуктовых файлов; новые evidence-логи в `docs/design/.../implementation-evidence/` — сгенерированные артефакты повторного прогона `validate-gate`, не код).

## Унаследовано из r1

Без повторного исполнения, т.к. окружение/материал/oracle этих проверок не менялись (подтверждено `read:log` — ни один коммит после `f4cc0bd54` не касается `src/`, `test/`, `demo/`, `scripts/`):

- Весь независимый разбор рисков (ABA/stale target, generation vs закрытие меню, cold/warm lazy-граница, гонки pan/zoom/камера, touch/kiosk, outside-click, мутанты-свидетели) — `docs/reviews/CODE-REVIEW-1089-r1.md`, раздел «Независимый разбор по рискам», SHA `f4cc0bd54be8d0fe43c367e4be067bfec859acf8`.
- AC1–AC11 — полностью проверены (код+смоук/юнит), таблица «AC → доказательство» в r1, то же SHA.
- AC12 — наследуется с одним исправлением: i18n/CHANGELOG/release-ledger часть была уже ✔ в r1; документный контракт UX-MODES теперь тоже ✔ (закрыто выше).
- Риск по изменённым участкам (#707): touch-токены `houseplan-card.ts:7593`, `view-device-menu.ts:50,57` → AC7/AC8/AC9; perf-токен `getBoundingClientRect` (`view-device-menu.ts:105`) → AC8/AC10; ux-токены новых ключей `view.menu_*` (RU/EN/DE/FR, включая `de.json:1350-1354` и ещё 23) → AC1/AC3/AC5/AC11/AC12 — все покрыты, классификация не меняется (код не менялся).
- Гейты `validate-gate` (материал `0dd219b03`, run `40608758430`, «review-light-golden proof is complete») — переиспользован как доказательство для продуктовой части; это тот же набор проверок, что покрывал `f4cc0bd54` плюс ре-валидацию на новом SHA после docs-правки.

## Как проверялось в этом раунде

Static-first: прочитан `REVIEW_CONTEXT` (тело issue, хендофф, AC→witness), `REVIEW_FINDINGS_POLICY` (`mode: issues`), `docs/reviews/CODE-REVIEW-1089-r1.md` целиком. Выполнено через `run_check`:

- `read:log` — подтверждён диапазон и состав коммитов r1→r2 (ровно 2: публикация отчёта + авторское исправление).
- `read:diff` — подтверждён точный hunk `docs/UX-MODES.md` (единственное содержательное изменение) и отсутствие новых изменений в продуктовом коде/тестах.

Независимое чтение (без доверия утверждению автора «других мест не осталось»): `docs/UX-MODES.md` целиком вокруг обоих абзацев; целевой `Grep` по формулировкам правого клика/#1050 в восьми документах подсистемы — описан выше, воспроизводим.

Полный `build`/`test`/`typecheck`/`gate:small` в этом раунде не гонял: единственное изменение раунда — markdown-текст без влияния на код/сборку/бандл/локали; `validate-gate` на точном материале `0dd219b03` уже зелёный (пакетное доказательство, run `40608758430`), и не нашёл AC/риска без пригодного доказательства, требующего нового прогона. Полных golden/pytest/invariants прогонов тоже не требовалось — ни один из их входов (код, геометрия, Python, визуальные сцены) в этом раунде не менялся.

## Что проверено и корректно

- M1 закрыт по существу: абзац `UX-MODES.md:252-258` больше не противоречит ни верхнему баннеру того же файла, ни фактическому поведению; формулировка согласована с остальными каноническими документами подсистемы.
- Диапазон коммитов r1→r2 ограничен ровно docs-правкой + публикацией отчёта — не внесено скрытых продуктовых изменений вне заявленного.
- Все выводы r1 (ABA/generation, lazy-граница, touch/kiosk, outside-click, i18n, release-ledger, мутанты-свидетели) остаются в силе — их входы не менялись.

## Чего не проверял / ограничения

- Полный `npm run build`/`npm test`/`typecheck`/`gate:small`/golden/pytest в этом раунде не перегонял — нет изменённого кода/конфигурации, способного их сломать; переиспользован зелёный `validate-gate` на точном материале.
- Арифметику бюджетов (`scripts/bundle-budget.mjs`) повторно не пересчитывал — не изменилась с r1 (подтверждено `read:diff`: файл отсутствует в hunk-списке этого раунда за пределами уже проверенного в r1 состояния).
- Полный реестр мутаций не исполнял — вне раунда ревью по общей политике (#709, #905); определения не менялись с r1.

## Гейты: что прогнано, что нет и почему

| Гейт | Статус | Основание |
|---|---|---|
| `read:log` | Выполнен | Сверка диапазона и состава коммитов r1→r2 |
| `read:diff` | Выполнен | Подтверждение единственного содержательного hunk (`UX-MODES.md`) и отсутствия новых правок кода/тестов |
| `validate-gate` (build/typecheck/bundle/тесты/смоуки) | Переиспользован, не повторялся | Зелёный на точном материале `0dd219b03`, run `40608758430`; единственное изменение раунда — markdown-текст, не затрагивающий ни один из этих проверяемых входов |
| Golden `view-device-menu-*` | Не перегонялся | Визуальные сцены и их входы не менялись в этом раунде (только r1-материал, уже проверен в r1) |
| Полный `npm run build`/`test`/`typecheck` отдельно от `validate-gate` | Не прогонялся | Не единственный способ проверки (#857); нет непокрытого риска, docs-only diff |
| `pytest tests_backend` | Не запускался | Нет diff по Python |
| `npm run invariants` | Не запускался | Нет правки геометрии |
| Полный реестр мутаций | Не запускался (и не должен в этом раунде) | #709/#905 — ночной прогон, не гейт ревью |

## Маршрут

`route: fix` (задан пакетом для трека `ask`). Побочных находок вне скоупа нет; `mode: issues` — outside_findings пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImU4NzRlNjFiZGRkNDZlNTkwZTZhOTNhMjIxYmMyODI4MTYxYjViZDkzZGQzYjgyNTQ5OTQ1YTEzZDE0Njg1MDUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0YmM4MTQyYWQ4NjBmNzE3MDFhOGMwYWI5Yjk0MWMwOWJlMjU4OTBlYjMyNGZhOGEwMzUzYTFhYTVkYzI5OWU5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiIwZGQyMTliMDNjNWYyOTBjYTdjOTRjNDE4MWM1ZDZiZGUwNTFkZTg3IiwidHJlZSI6IjIzZGE1YjliMDZlMTQzYTBkYWVmOTgxYzFiZjcyZjU3OTE1YmQyMzgiLCJib2R5RGlnZXN0IjoiZTZhNGE1NjU4ZDI2YzQyMzFlZDZjMWI3N2ZmODhmZDViMDUzZDcxZDU3ZjAxZjQyOTY1NWE3YTRhZWZkOTY2YyIsInByb2R1Y2VyUnVuIjoiNDA2MDk0NzQ2MjEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjBlZjhiNDg5ODYwNjdiY2EyMTllMjJkMTJlN2NmYWEwYmUwZGFhNzE2MTQyOTc3NzE1OTZiNjViNTUxZjNjNDAiLCJ2ZXJkaWN0RGlnZXN0IjoiMDdhZGEwOGUyMDZhNGNhNWYwYTVlNjc4YWJjYzdhODQ3MzA0OTc1OWIzYjhmM2UxN2Y0YmExMWU1YmMxMjUyNSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1MDUyZWI3MjQ2MGFhYmJlODFjZGI0NWY2YzI2M2ZhOGNkMmNiYTU3ODQxNWEyZWEyNDU0M2E0YTZhMzczZDEwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU3NTA2MzA2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg5I2lzc3VlY29tbWVudC02NDU3NTA2MzA2IiwiYm9keURpZ2VzdCI6IjhjM2M1OWYyODIzN2YyNjliZmM4YjkxY2I0ODQxNmM1NzNjMTJlNTc5YzJjNTgwZTViYzI1ZjhiZDE1MmE2MzYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1089-view-device-menu`, коммит `0dd219b03c5f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `23da5b9b06e143a0daef981c1bf72f57915bd238`
  ```
  git log --all --format='%H %T' | grep 23da5b9b06e1
  ```
- Тело issue: `e6a4a5658d26c4231ed6c1b77ff88fd5b053d71d57f01f429655a7a4aefd966c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40609474621,"run_attempt":1,"digest":"5666ca826b427fa1fd1039623fe58ac84536646f0f170e0f9ee4d64b0a51a94c"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzQsIm91dHB1dF90b2tlbnMiOjE3MzYzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk3NTg1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTM1OTcyMSwiY29zdFVzZEVzdGltYXRlIjowLjgzNTk4MjJ9XSwidHVybnMiOjI4LCJkdXJhdGlvbk1zIjoyMjQwMjcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjgzNTk4MjIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=34 output_tokens=17363 cache_creation_input_tokens=97585 cache_read_input_tokens=1359721 num_turns=28 -->
