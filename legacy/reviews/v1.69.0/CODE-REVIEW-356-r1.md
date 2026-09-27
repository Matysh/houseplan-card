# CODE-REVIEW-356-r1

**Issue:** #356 — «layout/set без expected_rev тоже перезаписывает молча — тот же
класс C4, что и config/set (#340)»
**Трек:** `trivial` (S1→S2→S5→S6→S7, ТЗ в теле issue, без spec-review-документа)
**Заход:** r1 · блокирующих циклов израсходовано 0/2 (лимит trivial-трека — 2)
**SHA материала:** `24c9a169ace86e8de502143b51874690828e0994` (единственный
коммит в диапазоне `origin/dev..HEAD`, `git rev-parse HEAD` совпадает)

## Скоуп

Диапазон `git diff origin/dev...HEAD`:

```
custom_components/houseplan/websocket_api.py | 22 ++++++--
docs/ARCHITECTURE.md                         |  2 +-
docs/CHANGELOG.md                            |  5 ++
docs/CHANGELOG.ru.md                         |  5 ++
docs/TESTING.md                              | 10 ++--
tests_backend/test_ha_websocket.py           | 80 ++++++++++++++++++++++++++++
```

Чисто бэкенд + документация; `src/**` не тронут вовсе (фронтенд не вызывает
`layout/set` — использует point-wise `layout/update`, см. «Проверено» ниже).
Ветка соответствует issue (`issue/356-layout-revision`), коммит несёт трейлеры
`Issue: #356` и `User-Visible: yes`, оба changelog правлены в том же коммите.

AC из тела issue (trivial-трек, ТЗ = issue):

- **AC1** — `layout/set` без `expected_rev` при `current rev > 0` возвращает
  `conflict` до canonical no-op/записи; store/rev/служебные поля не меняются,
  `houseplan_layout_updated` не отправляется. Доказательство: backend HA
  websocket test.
- **AC2** — bootstrap `rev=0` без `expected_rev` остаётся допустимым и создаёт
  `rev=1`; явный совпадающий `expected_rev` работает; явный stale `rev`
  получает `conflict`. Доказательство: backend HA websocket test + существующая
  CAS-матрица.
- **AC3** — schema оставляет `expected_rev` optional только ради bootstrap и
  стабильного доменного conflict; документация не обещает больше compatibility
  blind overwrite; EN/RU changelog сообщает о защите от тихой потери позиций.
  Доказательство: ревью кода и docs checks.

## Как проверялось

**Дешёвые гейты.** Подтверждённый в задании прогон Validate на этом же SHA
(`https://github.com/Matysh/houseplan-card/actions/runs/33179882646`) я
перепроверил напрямую (`gh run view 33179882646 --json jobs`): `conclusion:
success`, `headSha` совпадает с HEAD. Разбивка по job:

| Job | Результат |
|---|---|
| `changes` (классификация) | success |
| `reuse` | success |
| предполётные (docs/provenance/process-gate) | success |
| `hacs` | success |
| `hassfest` | success |
| **`frontend` (typecheck/test/build/bundle-sync)** | **skipped** |
| **`backend` (pytest в Home Assistant)** | **success** |
| `golden`, `smoke`, `performance_smoke` | skipped |

Важное уточнение к тексту задания: `npx tsc --noEmit` / `npm test` / `npm run
build` в этом прогоне не «подтверждены зелёным», а **корректно пропущены**
job'ом `changes` — путевой фильтр `frontend` требует изменений в
`src|demo|test|dist|custom_components/houseplan/frontend|package(-lock).json|
rollup.config|tsconfig`, и диапазон коммита ни одного из них не касается
(проверено: `git diff origin/dev...HEAD --stat` не содержит `src/**`, и `grep
-n "layout/set" src/` показывает единственное упоминание — в комментарии,
подтверждающем, что фронтенд ходит через `layout/update`, а не `layout/set`).
Поэтому пропуск этих гейтов не тихий — они здесь не применимы к диффу; гонять
их вручную ради нулевого покрытия диффа не стал.

`backend` job — единственный релевантный этому диффу тяжёлый гейт — реально
прогнан и зелёный на точном SHA; это и есть исполнение нового теста
`test_issue_356_layout_set_without_revision_is_bootstrap_only` в CI на Linux с
настоящим HA-харнессом. Локальный прогон pytest в этой ревью-среде недоступен
(`python3 -c "import homeassistant"` → `ModuleNotFoundError`, `.venv-backend`
отсутствует) — ожидаемое ограничение окружения ревьюера, см. `PROCESS.md`
«Backend»/`AGENTS.md` «Environments».

**Не прогонялось и почему:**
- `npm run golden:verify`, браузерные смоки, `node scripts/check-docs.mjs` —
  диф не трогает `src/**`/визуал, не применимо;
- `npm run invariants -- --config …` — диф не трогает геометрию комнат, рёбра,
  `marker.space`, `open_spans`; это чисто транспортный CAS-гейт над уже
  существующим layout-документом, модель не меняется;
- «одно число — один источник» — в диффе нет новой пользовательски видимой
  величины (это код отказа записи, а не отображаемое значение), не применимо.

**Прочитано вручную** (доказательство «чтением, не исполнением» там, где
автотеста нет — AC3 и общая согласованность):
- полный текст `ws_layout_set` (`websocket_api.py:559-616`) построчно, сверка
  порядка проверок с симметричным `ws_config_set` (audit C4/#340,
  `websocket_api.py:1286-1334`) — паттерн идентичен: warning без содержимого →
  `send_error("conflict")` → `return`, до вычисления `_live_layout`/no-op/записи;
- все остальные точки записи layout (`grep async_save_layout_state`) —
  `websocket_api.py:130,208,226,679,742,778,1096,1787,1803,1871,1882` и
  `__init__.py:160,169,223` — вызывают `async_save_layout_state` напрямую, не
  через `ws_layout_set`; правка их не касается, что соответствует заявленному
  «не-цели: `layout/update`, `layout/delete`, `import/optimize` не меняются»;
- существующие вызовы `houseplan/layout/set` без `expected_rev` в
  `tests_backend/test_ha_websocket.py` (строки 136, 214, 249, 320 и др.) — во
  всех случаях это первый layout-write в своём тесте (`rev=0` на входе), то
  есть законный bootstrap-путь, который правка не ломает; это же неявно
  подтверждено зелёным `backend` job (эти тесты входят в тот же файл и тот же
  прогон);
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/CHANGELOG(.ru).md` — текст
  соответствует фактическому поведению после правки, не обещает больше «blind
  overwrite для совместимости».

## Находки

Не найдено. High: 0, Medium: 0.

Разобрано отдельно и не сочтено находкой: тест «An equal body is still a write
attempt and must not bypass the CAS guard» (`test_ha_websocket.py:602-611`) —
хорошее покрытие ровно того случая, где conflict-проверка обязана стоять
**до** сравнения с canonical no-op, а не полагаться на то, что no-op сам по
себе безопасен без ревизии. Порядок в коде это подтверждает (см. выше).

## Что проверено и корректно

- **AC1** — доказано автотестом
  (`test_issue_356_layout_set_without_revision_is_bootstrap_only`, ветка
  «stale_client without expected_rev»), тест умеет падать: без правки старый
  код проверяет только `"expected_rev" in msg` (ложно) и не возвращает
  conflict, дошёл бы до записи нового `rev`/события — тогда
  `assert not rejected["success"]` и `assert layout_events == []` были бы
  красными. Подтверждено также прогоном на CI (`backend` job, success, тот же
  SHA).
- **AC2** — доказано тем же тестом (bootstrap-ветка `rev=0→1`, явный
  совпадающий `expected_rev=1` в конце) плюс не сломанной существующей
  CAS-матрицей (explicit stale rev в других тестах файла, не тронутых диффом).
- **AC3** — проверено чтением: docstring, `ARCHITECTURE.md` (табличная строка
  `layout/set`), `TESTING.md` (пункт про backend hardening) и оба changelog
  синхронно описывают новое поведение; формулировка симметрична описанию
  #340 для `config/set`.
- Утечки данных в лог нет: тест явно проверяет `"stale-secret" not in
  caplog.text`.
- Область изменения не задевает фронтенд, `layout/update`, `layout/delete`,
  `import/optimize`, что соответствует заявленным «не-целям» задачи и
  риск-оценке аналитика (P3, риск 3/10, ограничен старыми/сторонними
  клиентами).
- Трейлеры и changelog-дисциплина в порядке (`Issue: #356`, `User-Visible:
  yes`, правки в обоих changelog в том же коммите).

## Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` — не прогонял вручную;
  диф не содержит ни одного файла из `frontend`-фильтра, гейт CI сам корректно
  их пропустил (see «Как проверялось»), перегонять вслепую смысла не было бы:
  проверяли бы код, который не менялся.
- Полный `python -m pytest tests_backend -q` локально — недоступен в этой
  среде (нет `homeassistant`/`.venv-backend`); полагаюсь на зелёный `backend`
  job CI на точном SHA (перепроверено `gh run view` напрямую, не со слов
  автора).
- Golden, браузерные смоки, performance — не применимо, диф не трогает
  визуал/фронтенд.
- Инварианты модели геометрии — не применимо, диф не трогает геометрию.

## Вердикт

Зелёный. AC1–AC3 выполнены и доказаны (автотест, который умеет падать, плюс
независимо перепроверенный зелёный CI на точном SHA); находок нет; скоуп не
расширен; трейлеры и changelog в порядке.
