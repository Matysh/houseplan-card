# Код-ревью — issue #1120, заход r2

Материал: `63056d5e48ed4a618a12d1e6621520f817afbafb` (общий предок/база —
`70e470169be69f2e7c0e6be3d6f0d5c1216f66fd`, #1122 S8). Трек `ask`. Блокирующих
циклов 1/4.

## Скоуп

Это второй раунд ревью #1120. Полная функциональная реализация (удаление
собственной appbar/title основной страницы, перенос кнопки меню HA первой в
шапку карточки, замена фиксированных порогов адаптации реальным переполнением
по контракту r6, замена контракта #1103 «меню остаётся в киоске») признана
корректной в [CODE-REVIEW-1120-r1.md](CODE-REVIEW-1120-r1.md) (жёлтый,
H0/M1). Этот раунд правит ровно единственную находку r1 — документационное
противоречие в `docs/TOUCH-SUPPORT.md` между устаревшей строкой 5 и новым
абзацем того же файла (строки 46-50 в версии r1). Код, тесты, golden-эталоны и
остальные документы в этом раунде не менялись.

Служит строкам Core user jobs J1/J3/J6 (целостность главной живой панели и
её навигации на desktop/планшете/внешнем экране, SCOPE.md) — так же, как и в
r1; правка документационная и не затрагивает код этих сценариев.

## Как проверялось

Static-first: перечитан `REVIEW_CONTEXT` (тело issue, хендофф r2, `ciEvidence`),
канон (`docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`), полный текст
принятого отчёта r1 (`docs/reviews/CODE-REVIEW-1120-r1.md`) и обновлённый
`docs/TOUCH-SUPPORT.md` целиком.

Независимая проверка закрытия F1: сверено текущее содержимое
`docs/TOUCH-SUPPORT.md:5` с абзацем «Product contract» (строки 16-21) и с
абзацем про `/houseplan`-шапку (строки 46-52) того же файла — все три места
теперь утверждают одно и то же: House Plan kiosk (route/profile, `#1103`)
скрывает **весь** заголовок карточки вместе с перенесённой кнопкой меню HA,
выход — Back/обычный `/houseplan` URL. Дополнительно прогнан `grep` по всему
файлу на остаточные формулировки старого контракта («remain available»,
«menu/HA chrome») — совпадений, относящихся к меню/киоску, не найдено (есть
одно не связанное упоминание «header tabs remain available» про визуальный
переход редактора, не про меню/киоск).

Через `run_check` выполнено:
- `read:diff` — полный диф задачи от общего предка до материала r2; выделен
  и сверен ровно hunk `docs/TOUCH-SUPPORT.md:5` (единственная строка,
  текстуально совпадающая с цитатой из F1 r1 «Its menu/HA chrome remain
  available» → заменена на «The main-panel kiosk now hides the whole card
  header, including its HA menu (#1120)»).
- `read:log` — список коммитов диапазона: `63056d5e4` (правка F1),
  `0b0c741ea` (публикация отчёта r1 — конвейерный коммит, не авторский),
  `775ef9ee5` (материал r1) и более ранние коммиты реализации, уже
  рассмотренные в r1.

Это подтверждает заявление хендоффа «единственный авторский commit после
возврата содержит только C [правку TOUCH-SUPPORT.md]»: список коммитов и
диф не показывают изменений вне `docs/TOUCH-SUPPORT.md` в этом раунде (коммит
`0b0c741ea` — технический, публикует уже принятый r1-отчёт и пересчитывает
`docs/reviews/INDEX.md`).

## Находки

Новых находок нет.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| F1 (Medium, в скоупе) — `docs/TOUCH-SUPPORT.md` противоречит сам себе насчёт меню в киоске (строка 5 vs. новый абзац) | Строка 5 переформулирована: «The main-panel kiosk now hides the whole card header, including its HA menu (#1120); Back or the ordinary /houseplan URL exits» — дословно согласована с «Product contract» (строки 16-21: «House Plan kiosk hides its whole header and menu») и с абзацем про `/houseplan`-шапку (строки 46-52). Единственная правка коммита `63056d5e4` | `docs/TOUCH-SUPPORT.md:5`, сверено построчно с остальными упоминаниями kiosk/menu в этом же файле (см. «Как проверялось»); diff-хunk подтверждён `read:diff` |

## Унаследовано из r1

Принято без повторной проверки — код, тесты, golden-эталоны и остальные
документы в этом раунде не менялись, `read:diff`/`read:log` подтверждают, что
диапазон r1→r2 ограничен одной строкой `docs/TOUCH-SUPPORT.md`:

- **AC1** (меню первым в шапке, 44×44, публичная HA-политика видимости) —
  признано корректным в r1 по `src/panel-header-menu.ts` и
  `panel-header-menu.test.mjs`, SHA r1 `775ef9ee5df6ad3e545d70d9ad22173892c3d0f2`.
- **AC2** (киоск/ACL/Lovelace) — признано корректным в r1 по `_kiosk`,
  `.hdr.kioskhide{display:none}` в `src/houseplan-card.ts`/`chrome.styles.ts`,
  тем же SHA.
- **AC3** (упорядоченное переполнение/реверс по реальному содержимому) —
  признано корректным в r1 по `choosePanelHeader`, `panel-header-flow.test.mjs`,
  нативному `smoke_panel_header_overflow.mjs` (36 ширин).
- **AC4** (визуал r6) — признано корректным в r1 по каскаду
  `panel-header.styles.ts` и `styles-split.test.mjs`.
- **AC5/AC6** (действия/touch-цели/жесты при скрытых zoom-кнопках, граница
  1024 px) — признано корректным в r1 по `smoke_panel_header_overflow.mjs`
  на 320 px и неизменной логике Properties-брейкпоинта.
- **AC7** (отсутствие измерительного цикла/второго наблюдателя) — признано
  корректным в r1 по `updated()`/`_headerLeaseCleanup` и нативному смоку
  (0 новых узлов метрик за 12 холостых тиков, отсутствие
  `houseplan/(config|layout)/(get|set)`).
- **AC8** (документы/release evidence) — все пункты, кроме `TOUCH-SUPPORT.md`,
  признаны корректными в r1 (`USER-GUIDE.ru.md` §17, `UX-MODES.md`,
  `ARCHITECTURE.md`, оба `CHANGELOG`, `release-ledger/v1.82.0/1120.json`);
  пробел по `TOUCH-SUPPORT.md` был единственной находкой F1 и закрыт в этом
  раунде (см. выше).
- Негативные свидетельства/mutation-registry (`*-1120` declarations,
  «declaration only, not executed») — признаны соответствующими политике
  §2.7/#905 в r1, в этом раунде не затронуты.
- i18n (`mode.plan_short`/`devices_short`/`decor_short`/`panel.sidebar_menu`
  во всех 4 словарях, `test/i18n.test.mjs`) — признано корректным в r1, в
  этом раунде не затронуто.
- Трейлеры/changelog — признаны корректными в r1 (одно и то же число/факт в
  RU/EN changelog без расхождений); правка этого раунда не является
  пользовательски видимым изменением продукта, нового изменения в
  CHANGELOG не требует.

## Что проверено и корректно (этот раунд)

- Единственная авторская правка раунда — `docs/TOUCH-SUPPORT.md:5` —
  устраняет именно то противоречие, которое описывала находка F1, не вводя
  нового расхождения с другими местами того же файла или с
  `USER-GUIDE.ru.md §17`/`UX-MODES.md` (уже согласованными в r1).
- Диапазон коммитов r1→r2 (`read:log`) не содержит иных авторских изменений,
  кроме этой строки; технический коммит `0b0c741ea` — публикация уже принятого
  отчёта r1, не относится к продукту.
- CI на точном материале раунда (`validate-gate`,
  https://github.com/Matysh/houseplan-card/actions/runs/40868661270,
  «review-light-golden proof is complete») зелёный для SHA `63056d5e4`.

## Чего не проверял (адресно непригодно/избыточно для этого раунда)

- Код, unit/native smoke-тесты, golden-эталоны, i18n, release-ledger — не
  перепроверялись повторно: входы/окружение/oracle для них не изменились
  между r1 и r2 (подтверждено `read:diff`/`read:log`), а r1 уже дал по ним
  положительный, независимо проверенный результат. Политика ревью прямо
  разрешает не повторять уже пригодное доказательство при неизменном
  материале/env/oracle.
- Полный HA e2e и 320-сценовая golden-матрица — не гейт code-review (§11.4,
  предрелизный гейт); не переисполнялись ни в r1, ни в этом раунде.
- `npm run build`/`npm test`/`gate:small` целиком — не перезапускались:
  зелёный `validate-gate` для точного материала `63056d5e4` уже доступен
  (см. выше); правка этого раунда текстовая, в markdown-файле вне
  кода/тестов, повторный общий прогон не добавляет адресного доказательства.

## Гейты

| Гейт | Прогнан | Результат/основание |
|---|---|---|
| `validate-gate` на точном SHA `63056d5e4` | Переиспользован (контекстное свидетельство из `ciEvidence`) | GREEN, https://github.com/Matysh/houseplan-card/actions/runs/40868661270 — «review-light-golden proof is complete»; входы/окружение/oracle не менялись относительно r1 |
| `read:diff` (весь диапазон задачи, адресно — hunk `docs/TOUCH-SUPPORT.md`) | Прогнан в этом раунде | Подтвердил, что правка ограничена одной строкой и дословно устраняет цитату из F1 |
| `read:log` (коммиты диапазона) | Прогнан в этом раунде | Подтвердил, что после материала r1 (`775ef9ee5`) есть ровно один авторский коммит (`63056d5e4`) и один технический (`0b0c741ea`, публикация отчёта) |
| Unit/native smoke/golden из r1 (`panel-header-flow.test.mjs`, `panel-header-menu.test.mjs`, `smoke_panel_header_overflow.mjs`, golden-сцены) | Переиспользованы из r1, не перезапускались | PASS на SHA r1 `775ef9ee5` (полная обвязка — см. таблицу гейтов в CODE-REVIEW-1120-r1.md); входы для них в этом раунде не изменились |
| Реальный HA e2e (houseplan-e2e) | Не переисполнялся | Контекстное свидетельство из хендоффа r1/r2 (дважды прогнан автором на точном SHA775/FP84); полный HA — предрелизный гейт (§11.4), не гейт code-review |
| `pytest tests_backend` / `npm run invariants` | Не прогонялись | Диапазон раунда не трогает Python-бэкенд и не меняет геометрическую модель |

## Вердикт

Единственная находка F1 из r1 закрыта точечной и корректной правкой, новых
находок в этом раунде нет, High отсутствует.

Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 ·
Документ: docs/reviews/CODE-REVIEW-1120-r2.md

Маршрут публикации побочных находок: `mode=issues` (снимок политики,
round 2) — побочных Medium вне скоупа не обнаружено, `outside_findings`
пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjI4NTZmZTVmODBlYjIyZjIxODY5NjIzNmMwOTgzNjhlMjU1ZjZmZDA1MzY1MmVkNWMxMDgwZjNmMmM4OTRmZWQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlZGEzYmFmODBkNzdmZGI5YTVkM2MxZGVlNzIyOGZmOTllODc1ZDgxOTVlMDgzYmUzMmI3ZjFjODJjMDViMGM5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI2MzA1NmQ1ZTQ4ZWQ0YTYxOGExMmQxZTY2MjE1MjBmODE3YWZiYWZiIiwidHJlZSI6ImMyNDRiNTgwZmU4ZGM0NjZkZTViMDI2NmVhMGQ5MjZjOTRjMmUxZDMiLCJib2R5RGlnZXN0IjoiNDgzMzYxZjFlMGM4MDZkMzQ5ZGE2OTc1ZDQzZjBkNjY2YTJhM2I1NzUwNGI3OGJjNTlhNDMxNzViYzQwM2UyYSIsInByb2R1Y2VyUnVuIjoiNDA4NjkzNDIyNDEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImJiOWY0MWIyZGE3ODU1NzQ2YjJiYmNiMTViM2VlYzE0NzU2MWUzZTRmZjhhMmM4ZTYwZWI1YmMyZDM0MzhhMWYiLCJ2ZXJkaWN0RGlnZXN0IjoiMTliNzk4MWNiYTRjNDg0ODBlZWE3Mzc0MzUwN2M1MmUwY2VmYjI1NDNiZWFiYjliMWMxOTQ1ZGFkYzU5ZTcyMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlYzI2NjE0YWYzMmQzZTcyY2M3NTFkNzg1MjQ1MDgxZGEzNWJkYjA4YzAyOTg5MjgyNTFhZGQ5NTk3ZDEwODgzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDk2MTE3Nzg5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIwI2lzc3VlY29tbWVudC02NDk2MTE3Nzg5IiwiYm9keURpZ2VzdCI6IjAyMzZkODY3MjVjNDgzM2FjYTE1ODFkOWZmMmFhYzgwYmYxZDAxNmE5Y2VhNTNhMjUzZTIzNTJlZTIzYTdiM2UifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1120-panel-header-overflow`, коммит `63056d5e48ed` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c244b580fe8dc466de5b0266ea0d926c94c2e1d3`
  ```
  git log --all --format='%H %T' | grep c244b580fe8d
  ```
- Тело issue: `483361f1e0c806d349da6975d43f0d666a2a3b57504b78bc59a43175bc403e2a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40869342241,"run_attempt":1,"digest":"2d70c97ef39dfbb037fe8915b9be4dfbbeaa446da0ad4598477eb31c8d935d4c"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MjQsIm91dHB1dF90b2tlbnMiOjExOTMwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg2Njc4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NzQ2MjE3LCJjb3N0VXNkRXN0aW1hdGUiOjAuNjE1MzAzNDAwMDAwMDAwMX1dLCJ0dXJucyI6MTgsImR1cmF0aW9uTXMiOjE3MjI0NiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjE1MzAzNDAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=24 output_tokens=11930 cache_creation_input_tokens=86678 cache_read_input_tokens=746217 num_turns=18 -->
