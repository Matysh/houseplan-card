# Код-ревью — issue #1120, заход r1

Материал: `775ef9ee5df6ad3e545d70d9ad22173892c3d0f2` (база/общий предок —
`70e470169be69f2e7c0e6be3d6f0d5c1216f66fd`, #1122 S8). Трек `ask`. Блокирующих
циклов 0/4.

## Скоуп

Основная страница `/houseplan` (panelHost): убрать собственную внешнюю
appbar/title/резерв 56 px, перенести кнопку меню HA первой в шапку карточки,
заменить фиксированные пороги адаптации шапки реальным переполнением
содержимого (согласованный визуал r6), заменить контракт #1103 «меню остаётся
в киоске» на «киоск скрывает всю шапку карточки вместе с меню». Затронутые
файлы: `src/houseplan-panel.ts`, `src/panel-header-flow.ts`,
`src/panel-header-menu.ts`, `src/styles/panel-header.styles.ts`,
`src/houseplan-card.ts` (рендер/lifecycle/измерение), четыре словаря i18n,
связанные demo-смоки/юниты и документы (ARCHITECTURE, UX-MODES,
TOUCH-SUPPORT, USER-GUIDE RU/EN, оба CHANGELOG, release-ledger).

Служит строкам Core user jobs J1/J3/J6 (целостность главной живой панели и
её навигации на desktop/планшете/внешнем экране, SCOPE.md).

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` целиком (тело issue, хендофф,
`ciEvidence`), затем канон (`docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`) и материал задачи — `src/houseplan-panel.ts`,
`src/panel-header-flow.ts`, `src/panel-header-menu.ts`,
`src/styles/panel-header.styles.ts`, рискованные хунки
`src/houseplan-card.ts` (рендер шапки 11441–11525, lifecycle/ResizeObserver
4580–4750, `_panelHeaderContentKey`/`_renderPanelMenu`/`_renderEmptyPanelHeader`
995–1042), юнит-тесты `panel-header-flow.test.mjs`,
`panel-header-menu.test.mjs`, `houseplan-panel.test.mjs`, нативный смок
`smoke_panel_header_overflow.mjs`, `docs/data-hp-contract.json` (retired
`panel-title`), `docs/release-ledger/v1.82.0/1120.json`, оба CHANGELOG,
`docs/development-notes/1120-panel-header-overflow.md` (таблица AC/протекция),
`scripts/mutation-registry.mjs` (новые declarations `*-1120`), затем
ARCHITECTURE/UX-MODES/TOUCH-SUPPORT/USER-GUIDE.ru/USER-GUIDE(en) на предмет
согласованности формулировок после замены контракта #1103.

Независимый разбор — до чтения авторских выводов: прослежена логика
`choosePanelHeader`/`measurePanelHeader`/`PanelHeaderMemo` (упорядоченные
кандидаты, инертное native-metrics дерево, мемоизация по owner/content/width),
CSS-каскад `panel-header.styles.ts` (специфичность `[data-panel-flow]
[data-panel-phone]` против одиночного `[data-panel-flow]`, сокращение
разрыва на фазе 3, скругление `rotate-right` на фазах ≥2, перенос на фазе 4
с `justify-content:flex-start`), lifecycle в `updated()` (один `_roHdr`,
отключение при kiosk, `_headerLeaseCleanup`, отсутствие второго наблюдателя),
логика видимости меню в `panel-header-menu.ts` (publicной narrow/dockedSidebar/
kioskMode/external hasSidebar), путь `_kiosk` → `.hdr.kioskhide{display:none}`
(скрывает весь блок, включая меню, при любом источнике киоска — config flag
или route-kiosk).

Из `REVIEW_EXECUTION_POLICY` выполнены через `run_check`:
- `read:base:docs/TOUCH-SUPPORT.md` — сверка, что спорная строка присутствует
  в базовой (до-задачной) версии файла без изменений в этой задаче
  (см. находку ниже).
- `read:base:scripts/bundle-budget.mjs` — подготовительное чтение (бюджетные
  числа уже проверены в приложенном `ciEvidence`, доп. прогон `build:*` не
  потребовался — см. раздел «Гейты»).

## Находки

### F1 (Medium, в скоупе) — TOUCH-SUPPORT.md противоречит самому себе насчёт меню в киоске

`docs/TOUCH-SUPPORT.md:5` (не тронута этой задачей — подтверждено
`read:base:docs/TOUCH-SUPPORT.md`, текст идентичен базовой версии) всё ещё
утверждает: «The main panel also enters the same kiosk explicitly through
`/houseplan/kiosk[/N]`... **Its menu/HA chrome remain available**» — то есть
старый контракт #1103 «меню остаётся в киоске».

Это прямо противоречит новому абзацу того же документа,
`docs/TOUCH-SUPPORT.md:46-50` (добавлен этой задачей): «House Plan
route/profile kiosk hides **the whole header and menu**; Back or the ordinary
`/houseplan` URL exits» — и фактическому поведению кода: `_kiosk` в
`src/houseplan-card.ts:1287` истинен и для `this._config?.kiosk`, и для
route-kiosk (`this._routeKiosk.enabled`), а `.hdr.kioskhide { display: none; }`
(`src/styles/chrome.styles.ts:112`) скрывает весь блок `.hdr`, включая
перенесённую кнопку меню, независимо от источника киоска. То есть
действительное поведение соответствует новому абзацу, а строка 5 — устаревшее
и теперь ложное утверждение, оставленное без правки.

АС8 ТЗ прямо требует: «Устаревший контракт #1103 «меню остаётся в киоске»
явно заменён». Для `docs/USER-GUIDE.ru.md` (§17) и `docs/UX-MODES.md` замена
сделана корректно и однозначно; для `docs/TOUCH-SUPPORT.md` — файла,
который этот же АС8 называет в списке обязательных к обновлению и который
сам этой задачей правился (строки 46-60 добавлены) — старое предложение не
снято и не переформулировано, создавая в одном документе два взаимоисключающих
ответа на один вопрос «остаётся ли меню доступным при входе в киоск через
`/houseplan/kiosk[/N]`».

Воспроизведение: открыть `docs/TOUCH-SUPPORT.md`, сравнить строку 5 со
строками 46-50 того же файла на материале `775ef9ee5df6ad3e545d70d9ad22173892c3d0f2`.

Последствие: читатель документа (в т.ч. будущий автор/ревьюер #1113/#1103-
смежных задач) получает двусмысленный источник истины о контракте киоска
главной страницы — ровно то расхождение, которое §8 канона просит исключать
(один факт — один источник), и прямое невыполнение пункта АС8 про явную
замену устаревшего контракта.

Это не находка о работе кода — поведение верное и подтверждено нативным
смоком `smoke_panel_header_overflow.mjs` (скрытие `.hdr` целиком в kioskhide)
и `smoke_panel_route_kiosk.mjs` (`coldUrlHidesOwnHeader`). Это находка о
неполном выполнении документационной части AC8 в скоупе задачи.

## Что проверено и корректно

- **AC1** (меню первым в шапке, 44×44, публичная HA-политика видимости):
  `panel-header-menu.ts` использует только публичные поля
  (`narrow`/`dockedSidebar`/`kioskMode`/`auth.external.config.hasSidebar`/
  `localize`), юнит `panel-header-menu.test.mjs` покрывает современный и
  минимальный (без `kioskMode`) набор полей, внешний sidebar, авто-режим
  виджета и локализацию с фоллбэком — включая строгие границы (ровно один
  публичный bubbling/composed `hass-toggle-menu` на клик). `panel-menu`
  зарегистрирован в `docs/data-hp-contract.json`, `panel-title` явно
  retired с `1.83.0-beta.4`.
- **AC2** (киоск/ACL/Lovelace): `_kiosk` объединяет `config.kiosk` и
  route-kiosk; `.hdr.kioskhide{display:none}` скрывает шапку и меню целиком;
  `_renderEmptyPanelHeader` корректно сохраняет меню в pending/invalid/
  read-only-empty состояниях, но не в киоске (`if (!this.panelHost ||
  this._kiosk) return nothing;`). Lovelace (`panelHost=false`) не получает
  `_renderPanelMenu`/`_renderEmptyPanelHeader` — ветки защищены `this.panelHost`.
- **AC3** (упорядоченное переполнение/реверс по реальному содержимому):
  `choosePanelHeader` — чистая функция с линейным перебором кандидатов;
  `panel-header-flow.test.mjs` проверяет строгий порядок и его реверс на
  точных граничных дробных ширинах, немонотонные/невалидные (`NaN`/`Infinity`)
  кандидаты и инвалидацию мемо по owner/контенту/дробной ширине/шрифтам.
  Нативный `smoke_panel_header_overflow.mjs` прогоняет реальный хост через
  36 ширин (сужение+реверс), проверяет все 5 наблюдаемых стадий,
  монотонность в обе стороны, физический зазор 10 px на последней
  однострочной ширине и ровно обратный порядок при расширении.
- **AC4** (визуал r6): CSS соответствует контракту по каждому шагу —
  скрытие `.ml`/показ `.panel-mode-full` только на фазе 0 (styles.ts:30-34),
  скрытие zoom-out/fit/in с фазы 2 и скругление `rotate-right` с фазы 2
  (строки 46-59), компактный список пространств и сжатие зазора на фазе 3
  (строки 18-23, 60-63), перенос на фазу 4 с `justify-content:flex-start`
  для второй строки (строки 36-37, 64-66). `test/styles-split.test.mjs`
  фиксирует порядок каскада (`panelHeaderStyles` — последний слой) и что
  правила файла ограничены `:host([panel-host])`/`.panel-menu`/
  `.panel-header-metrics`.
- **AC5/AC6** (действия, touch-цели, жесты при скрытых zoom-кнопках):
  `smoke_panel_header_overflow.mjs` проверяет на 320 px, что телефонная
  шестерёнка сохраняет все действия редактора/пространств/настроек, крестик
  редактора 24 px, dirty Keep/Discard с сохранением текста и фокуса,
  широкие редакторы (fit/hit/centre, восстановление камеры). Отдельный
  `smoke_panel_header_touch.mjs` (не читался построчно — покрытие заявлено
  хендоффом и `ciEvidence`, изменений логики жестов в диффе не обнаружено).
- **AC7** (отсутствие измерительного цикла/второго наблюдателя): в
  `updated()` ровно один `_roHdr`, отключается при disconnect/смене
  stage-владельца/kiosk; `_headerLeaseCleanup` освобождает frame/focus/fonts
  подписки и мемо. Нативный смок проверяет `0` новых `.panel-header-metrics`
  узлов за 12 холостых HA-тиков и отсутствие вызовов
  `houseplan/(config|layout)/(get|set)` при resize/policy-изменениях.
- Негативные свидетельства и реестр: десять новых `*-1120` mutation
  declarations в `scripts/mutation-registry.mjs` честно помечены как
  «declaration only, not executed» в коде и в
  `docs/development-notes/1120-panel-header-overflow.md` (таблица
  «AC/protection · Executed ordinary oracle · Negative input / registered
  witness») — пустой третьей колонки нет ни по одному AC; политика
  §2.7/#905 (не исполнять мутанты вне ночного workflow) соблюдена.
- i18n: `mode.plan_short`/`devices_short`/`decor_short`/`panel.sidebar_menu`
  добавлены во все 4 словаря (en/ru/de/fr), `test/i18n.test.mjs` обновлён
  (German/French "equal to English" allowlist для `mode.plan_short` —
  Plan — языконезависимый термин во всех трёх).
- Трейлеры/changelog: оба `docs/CHANGELOG*.md` обновлены одним и тем же
  фактом на русском и английском без расхождения чисел; `release-ledger/
  v1.82.0/1120.json` — классификация `stable-fix`, обоснование относительно
  предыдущего stable приведено, `visual` называет затронутые golden-сцены
  и обоснование каждой.
- `docs/USER-GUIDE.ru.md` §17 и `docs/UX-MODES.md` корректно и явно заменяют
  контракт #1103 («Шапка карточки и перенесённое меню HA скрыты»).

## Чего не проверял (адресно непригодно/избыточно для этого раунда)

- Полный HA-харнес и реальный HA drawer (`houseplan-e2e`) — не переисполнялся;
  принят как контекстное свидетельство из `ciEvidence`/хендоффа (дважды
  прогнан на точном SHA775/FP84, последний run — 67 PASS/1 unexpected
  mobile/1 flaky dirtyZIP с отдельным blocker-issue #1125, не относящимся к
  коду #1120). Канон не требует полного HA-гейта на уровне ревью
  (PROCESS §11.4 — предрелизный гейт).
- Полная 320-сценовая golden-матрица и глобальная приёмка эталонов — не
  гейт задачи (бета-гейт), подтверждено `release-ledger.visual` с целевыми
  кадрами и их обоснованием.
- `npm run build`/`npm test`/`gate:small` целиком не перезапускались:
  совместимый зелёный `validate-gate` для точного материала
  `775ef9ee5df6ad3e545d70d9ad22173892c3d0f2` уже доступен
  (https://github.com/Matysh/houseplan-card/actions/runs/40850003680,
  `review-light-golden proof is complete`); повторный прогон без изменённых
  входов/окружения/oracle не требуется политикой.
- Построчно не читал `smoke_panel_header_touch.mjs`, `smoke_panel_route_kiosk.mjs`,
  `scripts/ci-registry-inventory.json`, `scripts/monolith-baseline.json`
  целиком — диапазон правок в этих файлах не расходится с заявленными в
  хендоффе числами/инвентарём, и целевые проверки (build/byte budget)
  покрыты зелёным validate-gate; точечно читал только фрагменты, нужные для
  проверки конкретных заявлений (`panel-route-kiosk-ignored` в registry,
  `read:base:docs/TOUCH-SUPPORT.md`).

## Гейты

| Гейт | Прогнан | Результат/основание |
|---|---|---|
| validate-gate (build/typecheck/unit/CSS-audit/budget) на точном SHA775 | Переиспользован | GREEN, https://github.com/Matysh/houseplan-card/actions/runs/40850003680 — `review-light-golden proof is complete`; входы/окружение/oracle не менялись |
| `smoke_panel_header_overflow.mjs` (новый, целевой для #1120) | Переиспользован из точного CI-пуша | PASS в составе 37 смоков (включая 33 required), см. хендофф; дополнительного адресного прогона не потребовалось — логика вычитана и соответствует заявленным инвариантам |
| `panel-header-flow.test.mjs` / `panel-header-menu.test.mjs` / `houseplan-panel.test.mjs` (unit) | Переиспользованы | PASS в том же CI-пуше (`product` workflow) |
| Golden-сцены из `release-ledger.visual` | Переиспользованы | PASS на точных SHA775/FP84/Chromium (12 target-кадров), см. хендофф; полная матрица — не гейт ревью |
| `pytest tests_backend` | Не прогонялся | Диапазон не трогает Python-бэкенд (нет изменений `custom_components/`) |
| `npm run invariants` | Не прогонялся | Диапазон не меняет геометрическую модель |
| Реальный HA e2e (houseplan-e2e) | Не переисполнялся ревьюером | Контекстное свидетельство — дважды прогнан автором на точном SHA775/FP84; полный HA — предрелизный гейт (§11.4), не гейт code-review |
| `read:base:docs/TOUCH-SUPPORT.md` | Прогнан в этом раунде | Подтвердил, что спорная строка 5 не менялась этой задачей и действительно противоречит новому абзацу того же файла (находка F1) |

## Вердикт

Один Medium в скоупе (F1, документация) при отсутствии High. По правилу
«Medium в скоупе чинится в текущем issue: без High это жёлтый вердикт и
повторный цикл» — зелёного вердикта не присуждаю.

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/CODE-REVIEW-1120-r1.md

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjMyZjQ1ODg4YWUxY2JjNGExNDVkZDQyMzA0ZGFiNGFjMWJmYmIzNjkxNDg3ODkxNTY3YTlmZjcxYzdkZjMwYzEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjOGM4ZGQ2OTRmYTNjYTE5MzU0NjZjZTRlN2JhYjdlYmQ4YWY5YmY1ZTFmOTc2NDk4YjUxMDI3NTdiODc3NWU0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI3NzVlZjllZTVkZjZhZDNlNTQ1ZDcwZDlhZDIyMTczODkyYzNkMGYyIiwidHJlZSI6IjdjMjg2Yjc4OTljNDNlNjk3NzdlMTE0ZGU3OTU4NTA5MjRiNzU4YmQiLCJib2R5RGlnZXN0IjoiNDgzMzYxZjFlMGM4MDZkMzQ5ZGE2OTc1ZDQzZjBkNjY2YTJhM2I1NzUwNGI3OGJjNTlhNDMxNzViYzQwM2UyYSIsInByb2R1Y2VyUnVuIjoiNDA4NjUxMDE0NDAiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjJhMjRjZjk2NzAzYjhjNDRkYjAzZDlhMmRlNWY1ZGE3YjE3NTZmMjAwY2FhYWMyMGVlMjI3NjVmMWI2NjhhNjgiLCJ2ZXJkaWN0RGlnZXN0IjoiYmZiZTYyYjcwMWU4OGFiZjYwNTc5MGY1ZTg4OTNiMDNmZTRiMmNlMWNlNGVmODQ3MTYwZWVjMDNmYTM1NDMzNiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI5MmZhNWZmOTNhZWVmNzRlMzFmOTA0ZGYyNWRmYWMxYTI2NWQwNjYxZDc2MzFhODE0ZWQzYjJkM2RjMGE3YzI4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDk1NTQ2MjQyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIwI2lzc3VlY29tbWVudC02NDk1NTQ2MjQyIiwiYm9keURpZ2VzdCI6ImQxN2Y5NDZjYTE1NmI4YmNlMzMxMzE0MzgzYWYzY2M2NmUwYWFlZWRjMWQwYmI4ZTM3NGExM2ViMGI2ZGQwNzgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1120-panel-header-overflow`, коммит `775ef9ee5df6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7c286b7899c43e69777e114de795850924b758bd`
  ```
  git log --all --format='%H %T' | grep 7c286b7899c4
  ```
- Тело issue: `483361f1e0c806d349da6975d43f0d666a2a3b57504b78bc59a43175bc403e2a`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTA4LCJvdXRwdXRfdG9rZW5zIjozMzY3NSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxOTE3NDUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NDI4OTk1LCJjb3N0VXNkRXN0aW1hdGUiOjIuNTg5NzQ0OTk5OTk5OTk5N31dLCJ0dXJucyI6NzEsImR1cmF0aW9uTXMiOjQzNDY2MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNTg5NzQ0OTk5OTk5OTk5NywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=108 output_tokens=33675 cache_creation_input_tokens=191745 cache_read_input_tokens=7428995 num_turns=71 -->
