# SPEC-REVIEW-892-r1

Issue: #892 · Этап: spec (ТЗ, PROCESS.md §2.4) · Трек: ask · Заход r1 ·
блокирующих циклов израсходовано 0/4 · Материал: тело issue #892,
`bodyDigest cd01e1d3…` · Материал кода, использованный для проверки фактических
заявлений ТЗ: `ef1aeaf6cf94f2f692654e975a4ee18c40b143a7` (рабочая копия, `git
rev-parse HEAD` сверен).

## Скоуп

ТЗ (J6, Plan maintenance) в теле issue #892 правит четыре поверхности:
`general-settings-dialog`/`optimize-plans-dialog` (права запуска Optimize и
Optimize Undo), предупреждение о непроверенных маршрутах пылесоса, разделение
report на видимые позиции и позиции отсутствующих этажей, и правило
`scripts/model-invariants.mjs` для legacy `grp_<area>`. Дубликат #869 закрыт
(проверено: `state: CLOSED`, метки без стадии) и его предметы (unknown-owner
reason, registry retry, diagnostics) исключены из скоупа — пересечения с ним
не нашёл.

## Как проверялось

Читал тело issue #892 (из REVIEW_CONTEXT, `bodyDigest` сверен), оба текущих
комментария issue (аналитика + хендофф, оба от автора/владельца, трек
`ask` подтверждён владельцем), закрытое issue #869 целиком (чтобы исключить
повтор скоупа), `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
`docs/VACUUM.md`. Код не ревьюируется на этом этапе, но каждое фактическое
утверждение ТЗ о **текущем** поведении кода проверено чтением материала на
точном SHA `ef1aeaf6` (рабочая копия уже на нём — не переключался):
`custom_components/houseplan/auth.py`, `websocket_api.py` (гейты
`ws_plan_optimize`/`ws_plan_optimize_undo`), `src/editors/general-settings-dialog.ts`,
`src/align-grid.ts`, `src/plan-optimizer.ts`, `src/space-reference-repair.ts`,
`scripts/model-invariants.mjs`, i18n-ключи RU/EN. Гейты не прогонял — на этом
этапе продуктовый код не меняется, зависимостей/Chromium нет (#696); это и
есть «не проверял» для этого ревью, раздел ниже.

## Находки

### Medium (в скоупе) — премиса «backend требует HA-admin» не подтверждается кодом; предлагаемое ужесточение не названо продуктовым вопросом

Воспроизведение (материал — текущий код на `ef1aeaf6`, не предложение автора):

- `custom_components/houseplan/auth.py:17-55` (`may_write`) — единая ACL для
  ВСЕХ операций записи, включая Optimize: при `admin_only=false` не-admin
  writer получает запись `return True` (через `GROUP_ID_READ_ONLY not in
  group_ids`), а не отказ.
- `custom_components/houseplan/websocket_api.py:2278-2280` (`ws_plan_optimize`)
  и `:2490-2492` (`ws_plan_optimize_undo`) — оба вызывают `_check_write`, то
  есть тот же `may_write`, **не** буквальный `user.is_admin`. Сообщение об
  ошибке «Only administrators may optimize plans» — общий для всех
  write-эндпоинтов шаблон текста (то же самое «Only administrators may edit
  the layout/configuration/…» висит на каждом из них, строки 771/825/1017/…), а
  не признак отдельной более строгой проверки именно для Optimize.
- `src/editors/general-settings-dialog.ts:256-287` — кнопка Optimize (`gs.align_all`,
  строка 280) **не** обёрнута в `host._canEdit` вовсе (в отличие от секции
  backup чуть выше, строка 260), то есть видна любому открывшему диалог, а не
  только «writer без admin».

Итого на материале review: сегодня non-admin writer (при `admin_only=false`)
видит Optimize **и Apply у него проходит** — backend его не отклоняет
(`may_write`, не `is_admin`). Текста «Проблема»/«Сценарий»/«Что человек увидит
до и после» ТЗ утверждают обратное как факт («backend требует HA-admin»,
«недоступная операция») — это не подтверждается чтением материала и не
помечено как предположение (§7.1: «догадка, записанная как факт, — худший вид
дефекта»).

Из этого следует более серьёзная вещь, чем неточная формулировка: Контракт
п.1 и AC1 на самом деле не чинят регрессию, а **вводят новое ограничение** —
Optimize/Undo становятся первым в продукте действием, требующим буквального
`user.is_admin`, в обход `admin_only=false`, которое `docs/SCOPE.md`
(строки 35-36) описывает как явную установку «let ordinary household users
edit» без перечисленных исключений. Сейчас такого разреза «writer, но не
admin» в продукте нет вообще — ни у Optimize, ни у любой другой операции
записи (grep по `is_admin` в `websocket_api.py` не находит отдельной более
строгой ветки ни для одного эндпоинта, строка 1632 — не об этом, это чтение
состояний, не запись). Решение убрать у части household writers уже
работающую сегодня возможность — ровно тот «продуктовый вопрос» из §7.1
(«какой объём видимых изменений входит в этот issue», «что человек может
делать»), который должен идти владельцу одним вопросом с предлагаемым
дефолтом, а не формулироваться как починка уже сломанного. ТЗ не содержит
такого вопроса и не помечает решение как предположение в разделе «Принято
предположительно» (там только report categories и permission guard —
техническое, не продуктовое).

Чем это вредит реализуемости: если AC1 реализовать по тексту «сервер
non-admin продолжает reject» как описание уже доказанного наблюдения — это
будет написано поверх неверной предпосылки, и мутационный тест AC1 («краснеет
при gate только `_canEdit`») будет защищать контракт, который сам по себе не
был продуктово согласован.

**Что нужно поправить автору:** либо (a) переписать «Проблема»/«Сценарий» —
признать явно, что сегодня Optimize НЕ более строг, чем остальная запись, и
вынести одним вопросом владельцу с предложенным дефолтом, должен ли Optimize
стать первым admin-only-действием в обход `admin_only=false` (с кратким
обоснованием — необратимость/риск операции), — либо (b) снять это требование
из контракта и обсуждать реальный пробел отдельно (например: кнопка видна
даже тем, кто вообще не writer, что и есть настоящий найденный дефект у
`general-settings-dialog.ts:280`, никак не описанный в ТЗ).

### Что проверено и корректно

- **Дубликат #869** закрыт, границы в ТЗ («не входят: unknown-owner reason,
  registry retry, diagnostics») соответствуют тому, что реально сделано там
  (`src/space-reference-repair.ts:359-381`, i18n-ключи `gs.optimize_unverified*`
  уже существуют в stable).
- **Контракт п.4 (model-invariants и legacy `grp_*`)** — заявление «ошибочно
  считает живым по существованию комнаты» подтверждено:
  `scripts/model-invariants.mjs:222-229` классифицирует `grp_<area>` как
  `live`/`absent` по `allAreas.has(areaOwner)`, тогда как реальный продукт
  (`src/space-reference-repair.ts:373-377`, правка #869: «after every
  marker/device check, so only the label changes — never the status, whatever
  the roster says») всегда даёт `legacy_group` → `unverified`, никогда не
  резолвит по имени area. Расхождение скрипта и продукта реальное, AC4
  («краснеет при allAreas→live») — корректный и исполнимый способ
  доказательства.
- **Контракт п.3 (moved/maxShift и отсутствующие этажи)** — заявление, что
  сегодняшний отчёт включает позиции отсутствующих пространств в общий
  `moved`/`maxShift`, подтверждено: `src/align-grid.ts:345-360`, комментарий
  в коде прямо формулирует тот же инвариант, который ТЗ просит сохранить
  («an entry whose space is gone still moves, and the promise must not
  shrink because of it»). Предлагаемое разделение на категории при сохранении
  консервативного total не противоречит существующему дизайну, AC3 исполним.
- **Контракт п.2 (vacuum warning)** — путь «Редактор устройств → пылесос →
  карты» соответствует `docs/VACUUM.md` («Route editing lives only in the
  lazy editor graph … `editors/vacuum-maps-section.ts`»); ключ
  `gs.optimize_vacuum_warning` уже существует в RU/EN (не новый, будет
  переработан текстом) — непротиворечиво с разделом «i18n» ТЗ.
- **Обязательные разделы §7.1** все присутствуют (сценарий, видимое до/после,
  проблема, скоуп/не-скоуп, контракт, UX, модель данных, i18n, AC1-5, план
  тестов, риски, откат, release-артефакты, «принято предположительно»);
  каждый AC называет способ доказательства (smoke/unit/backend) и для
  защитных AC — как минимум словесно описанное «чем краснеет» (AC1, AC4
  явно; AC3 — согласованность категорий/total, AC2 — byte-identical
  calibration/routes).
- **Release-артефакты**: `User-Visible: yes`, оба CHANGELOG, USER-GUIDE
  RU/EN заявлены — согласуется с видимым изменением текста предупреждений и
  поведения кнопки; ledger `stable-fix` относительно v1.80.1 выглядит
  обоснованным для бага в рамках текущей беты (не проверял сам
  `docs/release-ledger/1.80.1/892.json`, см. «чего не проверял»).

## Чего не проверял

- `docs/release-ledger/<previous-stable>/892.json` — файл ещё не существует
  (создаётся на этапе реализации/мерджа), классификацию major/infra/stable-fix/
  line-fix на этом этапе проверить нечем; оставляю на код-ревью.
- `typecheck`/`npm test`/`npm run build`, golden, smoke, pytest, invariants —
  не гонял: это этап `spec`, продуктовый код не менялся, зависимости и
  Chromium не ставились (#696), а полные наборы — предрелизный гейт
  (`docs/process/REVIEWER.md`, «Объём гейтов»). Их место — код-ревью после
  реализации.
- Не воспроизводил заявленные F88–F91 из `findings-2026-10-08.md` вживую на
  плане владельца (файл не входит в репозиторий и не обязан — находки
  переносились аналитикой автора в тело issue; я проверял только
  производные от них утверждения о текущем коде, см. выше).
- Не оспаривал структуру report categories и shared permission guard —
  раздел «принято предположительно» явно разрешает их менять свободно,
  ревью туда не лезло.

## Вердикт

Один found Medium в скоупе — требует правки автора в теле issue перед
следующим заходом. High нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `ef1aeaf6cf94` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c017a35e0a1fd3b3a5043aa3b969a09901c92316`
  ```
  git log --all --format='%H %T' | grep c017a35e0a1f
  ```
- Тело issue: `cd01e1d37e729da5d9486834a269f04d65048f0cc5c645f1a0ad21129e3cd22b`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNjksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzU0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMDQsIm91dHB1dF90b2tlbnMiOjMxODg4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk3MTQzLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDMwOTM2MywiY29zdFVzZEVzdGltYXRlIjoxLjU2OTUzMjU5OTk5OTk5OTh9XSwidHVybnMiOjY1LCJkdXJhdGlvbk1zIjo0MTY4NDMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjU3Mzg4NjU5OTk5OTk5OTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4373 output_tokens=31905 cache_creation_input_tokens=97143 cache_read_input_tokens=4309363 num_turns=65 -->
