# SPEC-REVIEW-1037-r2

Issue: #1037 · Трек: `ask` · Этап: spec · Заход: r2 · блокирующих циклов израсходовано 1 из 4 (после этого
вердикта — 2 из 4)

Материал: тело issue #1037, раздел `## ТЗ` (плюс продуктовая преамбула выше — согласованы). `bodyDigest` из
`REVIEW_CONTEXT`: `cda1ce05ca4cfe792e92eb97184df9daac8ca7f635618214921a72a9be815056` — отличается от digest r1
(`bc8f9b86d98f67ec241bdc375ceeba3b93935d1342ac7f3425d7a55bb53354cd`), сверен с актуальным телом issue, полученным
через `gh issue view 1037 --json body`. Продуктовый код не менялся: `git diff --stat
307a859f506474cf3dc52f388642bae2f7b901a6..HEAD -- src custom_components` пуст, `git status` чист, `HEAD` —
`0f92444151b6aaaf74e2cead823c5f3d2f04daa7` (сам r1-документ, docs-only). Рабочая копия на материале.

Прочитан обязательный пакет: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`; документ и якоря
предыдущего раунда `docs/reviews/SPEC-REVIEW-1037-r1.md`; все текущие комментарии issue (аналитика, продуктовый
вопрос/ответ, хендофф r1, вердикт конвейера r1, хендофф r2). Round-scope (§2.10): адресно перечитан новый материал
— раздел `### DOM-identity и E2E-контракт` тела issue целиком и прилегающие правки «Файлы и модули»/«Release-
артефакты» — против `docs/STYLING-HOOKS.md` §7 целиком (не только §7.1, как в r1, а всё §7: 7.1 Compatibility
promise, 7.8 E2E scene and form identities) и `docs/data-hp-contract.json` (реестр `retiredHooks`,
`rootAttributes`, цветовые хосты в §7-таблице STYLING-HOOKS.md:533-540). Остальные разделы ТЗ (сценарий, модель
данных, миграция, риски, i18n, план автотестов) не трогались делтой — не перечитывались построчно заново, их
корректность унаследована из r1 (раздел ниже).

## Скоуп

Делта r2 — только раздел `### DOM-identity и E2E-контракт` (новый) плюс точечные правки «Файлы и модули» и
«Release-артефакты» (добавлены `docs/STYLING-HOOKS.md`, `demo/smoke_e2e_hooks.mjs`, `docs/data-hp-contract.json`).
Продуктовый контракт, модель данных, UX, i18n, план автотестов и критерии приёмки AC1–AC10 не менялись (сверено —
текст этих разделов побайтово совпадает с тем, что описано и процитировано в SPEC-REVIEW-1037-r1.md). Это прямо
узкая, локальная дельта — полный разбор ТЗ целиком не требуется, см. «Повторный раунд» (`docs/process/
REVIEWER.md`).

## Как проверялось

- Сравнение дельты: `git log --oneline` подтверждает, что между материалом r1 (`307a859f5`) и текущим `HEAD`
  (`0f9244415`) нет продуктовых коммитов — весь r1→r2 диф целиком лежит в теле issue, не в репозитории.
  Текст хендоффа автора (комментарий `2026-10-22T20:43:05Z`) описывает ровно то же изменение, которое видно в
  актуальном теле: новая DOM-таблица + явное упоминание `STYLING-HOOKS.md`/`smoke_e2e_hooks.mjs`/
  `data-hp-contract.json` в «Файлы и модули»/«Release-артефакты».
- `docs/STYLING-HOOKS.md:533-540` (действующий реестр цветовых хостов: `gs-fill-<palette key>`, `gs-wall-fill`,
  `gs-bg-color`, `gs-glow-color`, `space-border-color`, `space-fill-color`, `space-bg-color`, `room-fill-color`,
  `marker-glow-color`, `marker-activity-color`, `decor-color`) сверен построчно с новой DOM-таблицей тела issue:
  `space-border-color`, `space-fill-color`, `room-fill-color` — сохраняются как заявлено; `space-name-color`,
  `space-wall-fill`, `room-name-color-mode`, `room-name-color` — новые, не конфликтуют с занятыми именами;
  `gs-wall-fill` — удаляется. Расхождений с действующим реестром нет, новые имена следуют конвенции `gs-*/
  space-*/room-*` (`docs/STYLING-HOOKS.md:510-512`, «Native controls use their existing semantic id/name»).
- `docs/STYLING-HOOKS.md:364-376` (§7.1 Compatibility promise) прочитан целиком, не только предложение про
  «presence follows the product», которое ТЗ цитирует. Полный текст подраздела: «A public `data-hp` value...
  is not renamed or removed silently. A necessary incompatible change is announced in both changelogs and
  keeps a compatible transition for one following **stable** release», и отдельным пунктом — «Presence follows
  the product. If permission, mode or state means that an existing control is not rendered, its hook is absent
  too. No hidden testing duplicate is created.» Эти два пункта описывают разные ситуации: второй — временное/
  условное отсутствие контрола по текущему состоянию продукта; первый — несовместимое удаление задокументированной
  публичной идентичности.
- `docs/data-hp-contract.json:1081-1087` — действующий механизм ровно для первого случая: ключ `retiredHooks`,
  уже содержащий прецедент `room-draft` (`"since": "1.60.2-beta.1", "retired": "1.73.0-beta.1", "reason": "...
  replaced by ordinary partitions in issue #478."`) — то есть именно хук, чья функция была заменена другим
  механизмом, а не только временно скрыта состоянием. Это прямой прецедент для `gs-wall-fill` (функция
  переносится в `space-wall-fill`, а не временно прячется).
- `docs/reviews/CODE-REVIEW-1011-r3.md` (прецедент, на который опирался r1) перечитан на предмет правил удаления
  хоста — там обсуждается только смысловое рассогласование `data-field`, не удаление; прецедент
  `room-draft`/`retiredHooks` в нём не фигурирует — это отдельный, более прямой прецедент именно для данной
  задачи.

## Находки

### Medium (в скоупе) — удаление `gs-wall-fill` не адресует механизм `retiredHooks` и «compatible transition», на которые ссылается само ТЗ

**Что не так.** Новый раздел `### DOM-identity и E2E-контракт` тела issue пишет про `gs-wall-fill`: «Контрол
удаляется по продуктовой задаче; не переносить общий id в пространство и не оставлять скрытый testing-дубликат»
— и обосновывает это так: «Отсутствие удалённого/условно скрытого контрола следует продукту по §7.1». Это верно
цитирует только одно предложение §7.1 STYLING-HOOKS.md («presence follows the product... no hidden testing
duplicate»), но то же самое §7.1, двумя предложениями выше, говорит: публичная идентичность `data-hp`
«is not renamed or removed silently», а несовместимое изменение «announced in both changelogs and keeps a
compatible transition for one following stable release». `gs-wall-fill` — задокументированная публичная
идентичность (`docs/STYLING-HOOKS.md:535`), и её удаление в этой задаче — не временное исчезновение по текущему
состоянию/режиму (контрол не «иногда не рендерится», он исчезает из продукта навсегда вместе с полем общих
настроек), а именно несовместимое удаление в терминах §7.1. Канонический документ уже содержит рабочий механизм
ровно для этого случая — реестр `retiredHooks` в `docs/data-hp-contract.json` с прецедентом `room-draft`
(функция хука заменена другим механизмом — ровно ситуация `gs-wall-fill → space-wall-fill`). Новая правка ТЗ
«Файлы и модули» называет `docs/data-hp-contract.json` только условно: «при необходимости аддитивная metadata» —
не решает явно, регистрируется ли `gs-wall-fill` в `retiredHooks` по образцу `room-draft`, или почему это не
требуется.

**Почему это находка, а не мелочь.** Структурно это тот же тип дефекта, что закрывался в r1: ТЗ ссылается на
канонический документ подсистемы, но не доводит разбор до конца — берёт из него удобную half-цитату и оставляет
нерешённым соседний пункт того же подраздела, для которого в том же файле уже есть прецедентный, задействованный
механизм (`retiredHooks`, не теоретический — активно используется для `room-draft`). Без явного решения реализатор
на следующем шаге либо пропустит регистрацию отставки хоста (контракт `data-hp-contract.json` молча перестанет
отражать реальность, как и произошло бы без розыгрыша `retiredHooks`), либо откроет тот же вопрос заново, что ТЗ
уже должно было закрыть. AC9/AC10 оба ссылаются на «Host-id и их владельцы соответствуют DOM-таблице» и «schema
manifest и config-field registry» как доказательство — ни один не проверяет состояние `retiredHooks`, то есть
пробел не покрыт даже на уровне доказательства AC.

**Чем доказывается находка.** Непосредственное чтение: `docs/STYLING-HOOKS.md:364-376` (§7.1 целиком, не
полпредложения) против текста тела issue, раздел `### DOM-identity и E2E-контракт`, строка про `gs-wall-fill` и
следующее за таблицей предложение «Отсутствие удалённого/условно скрытого контрола следует продукту по §7.1»;
`docs/data-hp-contract.json:1081-1087` (`retiredHooks.room-draft`) — реестр и прецедент существуют, в теле issue
не упомянуты ни разу (`grep -c "retiredHooks" <<< "$(gh issue view 1037 --json body -q .body)"` → `0`).

**Это не находка «владельцу».** Как и в r1, решение о том, регистрировать ли конкретный хук в `retiredHooks` —
чисто техническое (имя/механика идентичности, §7.1 PROCESS.md), не продуктовое; я прошу автора явно решить этот
вопрос в тексте ТЗ, а не владельца.

**Статус:** Medium, в скоупе задачи (раздел DOM-identity — прямой предмет этой правки ТЗ) → жёлтый вердикт,
правится в текущем issue.

## Что проверено и корректно

- **Закрытие r1 подтверждено построчно, не на слово автора.** Новая DOM-таблица покрывает все восемь позиций,
  которые r1 требовал назвать явно: `space-border-color` (сохранена за «Цвет стен»), новый `space-name-color`,
  `space-fill-color` (сохранена), новый `space-wall-fill` (взамен удаляемого `gs-wall-fill`), новый
  `room-name-color-mode`, новый `room-name-color`, `room-fill-color` (сохранена), и явное удаление `gs-wall-fill`
  без переноса id и без скрытого testing-дубликата. `docs/STYLING-HOOKS.md` и `demo/smoke_e2e_hooks.mjs` теперь
  названы и в «Файлы и модули», и в «Release-артефакты» (ровно то, чего не хватало в r1).
- Новые имена хостов не конфликтуют с занятыми идентичностями реестра (`docs/STYLING-HOOKS.md:533-540`) и следуют
  установленной конвенции префиксов `gs-*/space-*/room-*`.
- `schemaVersion: 1` и существующие `colour-*`-идентичности внутри общего пикера корректно оставлены без
  изменений — соответствует `docs/STYLING-HOOKS.md:547` («compatible additions... remain unchanged»).
- AC9 обновлён и явно ссылается на новую DOM-таблицу («Host-id и их владельцы соответствуют DOM-таблице»,
  «gs-wall-fill отсутствует вместе с удалённым контролом») — критерий приёмки синхронизирован с новым разделом,
  не повис отдельно от него.
- Остальной текст ТЗ (контракт поведения, модель данных/миграция, UX, i18n, план автотестов, риски, откат,
  release-артефакты) не изменился между r1 и r2 — проверено отсутствием продуктового и текстового дрейфа вне
  одного раздела (вручную сверены границы раздела `### DOM-identity и E2E-контракт` и соседних правок в
  «Файлы и модули»/«Release-артефакты»; остальные разделы идентичны процитированным в SPEC-REVIEW-1037-r1.md).

## Чего не проверял

- **Автотесты/гейты не запускались.** Продуктовый код не менялся (`git diff --stat` между материалами r1 и r2
  пуст), `node_modules` отсутствует (#696, ожидаемо на этапе `spec`). `npx tsc --noEmit`, `npm test`, `npm run
  build` не дали бы на этапе spec ничего сверх факта «дерево не менялось с r1» — тот же факт уже подтверждён
  прямым git-диффом, более точным инструментом для этого вопроса.
- Не перечитывал заново построчно разделы, не затронутые делтой (контракт поведения, модель данных и миграция,
  план автотестов, i18n, риски, откат) — их корректность унаследована из r1 без повторной проверки, см. раздел
  ниже; делта их не касается, а round-scope (§2.10) просит разбирать именно дельту, а не задачу целиком.
- Не проверял `docs/release-ledger/<previous-stable>/1037.json` — релизная классификация (`major`) решается до
  S7 (§2.6, §11.9), не на этапе ТЗ.
- Не запускал браузер/демо-стенд — реализации ещё нет, Chromium не установлен (#696); все сверки — чтением
  документов и issue, не исполнением.
- Не выяснял практику проекта по вопросу «обязателен ли фактический переходный период до публикации стабильного
  релиза при удалении хука, или `retiredHooks`-запись постфактум достаточна» — в репозитории нет прежнего
  ревью, явно разбиравшего этот вопрос (`room-draft` — единственный прецедент, ретроспективная запись без
  описания процесса принятия решения); поэтому находка выше сформулирована как «решение не названо», а не как
  «нарушение конкретно установленной процедуры».

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
| --- | --- | --- |
| Medium: ТЗ не называет `docs/STYLING-HOOKS.md`/`demo/smoke_e2e_hooks.mjs` в «Файлы и модули»/«Release-артефакты», DOM-идентичность переносимых/разделяемых полей не решена | Новый раздел `### DOM-identity и E2E-контракт` с полной таблицей из 8 хостов (сохраняемые/новые/удаляемый) плюс явное добавление `docs/STYLING-HOOKS.md`, `demo/smoke_e2e_hooks.mjs`, `docs/data-hp-contract.json` в «Файлы и модули» и «Release-артефакты» | Тело issue #1037, раздел `### DOM-identity и E2E-контракт` (таблица «Контрол · data-hp=field data-field · Решение»); строка «Файлы и модули»: «`docs/STYLING-HOOKS.md`, `docs/data-hp-contract.json`... `demo/smoke_e2e_hooks.mjs`: контракт владельцев цветовых полей...»; строка «Release-артефакты»: «**docs/STYLING-HOOKS.md и проверка demo/smoke_e2e_hooks.mjs**» |

Закрытие полное и предметное (не формальная отписка) — см. «Что проверено и корректно». Новый, более узкий
пробел в этом же разделе зафиксирован как отдельная находка выше, цикла r1 он не продолжает (это новый текст,
которого в r1 не существовало).

## Унаследовано из r1 (без повторной проверки)

Из `docs/reviews/SPEC-REVIEW-1037-r1.md` (материал `dev@307a859f506474cf3dc52f388642bae2f7b901a6`) принято без
повторной сверки, так как делта r2 эти участки не трогает:

- Обязательные разделы §7.1 присутствуют, DoR §2.5 выполнен (AC1–AC10 пронумерованы, у каждого способ
  доказательства; i18n RU/EN/DE/FR ключи названы; performance названа явно; touch-правило сформулировано).
- Миграционные формулы (`min(1, room_opacity+0.25)`, дефолты новых пространств `#55606c/0.55`→`0.80`, белый
  `wall_fill` `{c:'#ffffff',a:1}`) сверены построчно с `src/logic.ts`, `src/space-render.ts`,
  `src/houseplan-card.ts` на материале r1 — расхождений нет.
- `_SPACE_DISPLAY_FIELDS`/`_ROOM_DISPLAY_FIELDS` (`custom_components/houseplan/import_export.py:90-99`),
  `support_package.py`, `support_wire_schema.py`, `validation.py` — названные в ТЗ модули переноса существуют и
  содержат заявленные поля.
- Прецеденты additive-миграции без version bump (`docs/CONFIG-COMPATIBILITY.md` «Independent Glow compatibility»
  #943, «Space settings compatibility» #945) соответствуют техническому контракту ТЗ п.8.
- Отступление от универсального принципа «global → space → room → device» в `docs/ARCHITECTURE.md` «Settings
  tiers» — осознанное, подтверждено владельцем в преамбуле issue, не маскируется.
- `docs/PDF-EXPORT.md:15-18` подтверждает корректность не-скоупа по печатной палитре.
- Продуктовый вопрос («цвет названий красит весь блок подписи или только имя») закрыт владельцем по форме §7.1,
  открытых продуктовых вопросов нет.

## Вердикт

Жёлтый. Один новый Medium-дефект **в скоупе** (удаление `gs-wall-fill` не адресует `retiredHooks`/«compatible
transition» из того же §7.1 STYLING-HOOKS.md, который само ТЗ цитирует), High — 0. Находка r1 закрыта полностью и
предметно. Побочных находок вне скоупа нет; по `REVIEW_FINDINGS_POLICY` (`mode=issues`) это не требуется —
применимо только к Medium вне скоупа, которых нет. ТЗ возвращается автору на правку в рамках текущего issue.

Маршрут: `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `0f92444151b6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fe0c1d05c8150de53505dd16395e76d3ec9d948d`
  ```
  git log --all --format='%H %T' | grep fe0c1d05c815
  ```
- Тело issue: `cda1ce05ca4cfe792e92eb97184df9daac8ca7f635618214921a72a9be815056`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MTMsIm91dHB1dF90b2tlbnMiOjIyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzIzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Niwib3V0cHV0X3Rva2VucyI6MzgyMzcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6OTk1OTIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyNTAyMjQ3LCJjb3N0VXNkRXN0aW1hdGUiOjEuMjgxMjk5Mzk5OTk5OTk5OH1dLCJ0dXJucyI6MzgsImR1cmF0aW9uTXMiOjQwNTYwNiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuMjg2MDIyMzk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4669 output_tokens=38259 cache_creation_input_tokens=99592 cache_read_input_tokens=2502247 num_turns=38 -->
