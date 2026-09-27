# CODE-REVIEW-33-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/33
- ТЗ: docs/specs/033-config-schema-lifecycle.md (ревизия 3, зелёное ревью SPEC-REVIEW-33-r2)
- Ветка: `issue/33-config-schema-lifecycle`
- SHA материала ревью: `572cf928969fd8849299170ba3d42ff61d7ef423` (`git rev-parse HEAD`)
- Заход: r1 (первый код-ревью этого issue; ревью ТЗ не расходует бюджет код-ревью, §10.4/§2.10)
- Диапазон: `origin/dev..HEAD` — 4 коммита (`24681ee2` feat, `867f4762` feat, `f4318721` fix, `572cf928` build)

## Скоуп

Ревизия 3 ТЗ, три блока:
1. Генерируемый манифест схемы (`scripts/dump-config-schema.py` → `scripts/config-schema.json`, 265 листовых путей), pytest на свежесть.
2. Parity-тест 8 enum-пар backend↔frontend через `scripts/schema-compat-allowlist.mjs`; тест полноты `config-field-registry.mjs`; новые `as const`-декларации (`OPENING_TYPES`, `VACUUM_TRAIL_MODES`, `ZERO_WALL_STYLES`, `BG_MODES`); паспорта registry (`enforcedBy`, `schema: 'allow-extra'|'lovelace-card'`, 3 новых current-паспорта).
3. Lifecycle-фикстуры (oldest/current/future), pytest на lossless/round-trip; `config-audit.mjs` — контракт exit-code 0/3/2.

Рантайм-поведение не меняется (заявлено ТЗ, подтверждено чтением: новые `as const`-массивы нигде не потребляются продуктовым кодом, кроме вывода типа).

## Как проверялось

Дешёвые гейты прогнаны лично на SHA `572cf928`:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто |
| unit | `npm test` | 1608 pass / 0 fail / 1 skipped (совпадает с хендоффом) |
| build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| три копии бандла | `npm run bundle:sync` | git status чист после — дерево уже синхронизировано |
| docs fingerprint | `node scripts/check-docs.mjs` | "Documentation checks passed (7 files, 10 external links)" — обязателен, т.к. diff трогает `src/**` (sun.ts, types.ts) |
| бюджет | `npm run bundle:budget` | `initial View: 279147 B gzip (budget 300000 B, headroom 20853 B)` — совпадает с заявленным |
| backend, новый файл | `python3 -m pytest tests_backend/test_config_schema_manifest.py -q` | 3 passed (после `pip install pytest pytest-asyncio voluptuous` — в песочнице их не было) |
| backend, полный `tests_backend` | `python3 -m pytest tests_backend -q` | падает на сборе (`ModuleNotFoundError: homeassistant` в `test_coordinate_canonicalization.py`) — **не регрессия этой задачи**: файл не тронут диффом и не подпадает под `test_ha_*` исключение из `conftest.py`; ограничение окружения без HA, а не дефект #33 |
| дамп свежий | `python3 scripts/dump-config-schema.py --check` | `manifest fresh: 265 paths` |
| parity + audit unit | `node --test test/config-audit.test.mjs test/config-schema-parity.test.mjs` | 8/8 pass |
| model-invariants | `npm run invariants -- --config test/fixtures/config-lifecycle/{oldest-supported,current,future-fields}.json` (все три; diff трогает `types.ts`/geometry-смежные lifecycle-фикстуры) | все три: "Инварианты выполнены: ссылки разрешимы, записи толщины находятся"; на current/future — 4 информационных наблюдения (exact-endpoints вместо ключа), не нарушения |
| мутанты (по делу, не полный набор — дорогой гейт, PROCESS §8/§4) | `node scripts/mutation-gate.mjs --id=schema-manifest-enum-drift` и `--id=registry-selector-dead-decision` | оба «поймано 1 из 1» |

**Не прогонял и почему:**
- `python -m pytest tests_backend -q` (полный набор с HA) — недоступен в песочнице (нет `homeassistant`, нет `.venv-backend`); согласно AGENTS.md это ожидаемое ограничение локальной среды, а не гейт этой задачи. Новый файл `test_config_schema_manifest.py` — единственный, добавленный диффом, — прогнан отдельно и зелёный.
- Полный `npm run mutation-gate` (весь реестр мутантов) — дорогой предрелизный гейт (документировано в самом скрипте: «место — перед стабильным релизом»); прогнаны только два новых мутанта, относящихся к диффу.
- Браузерные смоки — `node scripts/smoke-select.mjs --base origin/dev --head HEAD` вернул **НЕОПРЕДЕЛЁННОСТЬ**: ни один из 205 смоков не связан с изменёнными символами (`BG_MODES`, `OPENING_TYPES`, `VACUUM_TRAIL_MODES`, `ZERO_WALL_STYLES` и их типы). Проверено чтением: `grep` по `src/*.ts` показывает, что эти константы нигде не потребляются продуктовым кодом кроме вывода типа — они существуют исключительно ради `test/config-schema-parity.test.mjs`. Раз рантайм-поведение этих символов не меняется, смок не может ничего увидеть; решение — не гонять сверх того, что автор уже прогнал (`smoke_space_card`, `smoke_decor` — сами по себе не обязательны, но безвредны).
- `npm run golden:verify` — diff не меняет рендер/геометрию/стили, только типы и build/test-инфраструктуру; не запускал.

## Находки

Все три — Medium, все в скоупе задачи (правятся в этом же issue, без Hig
h и без нового issue).

### M1 — AC7-тест не может поймать то, для чего он написан

`test/config-schema-parity.test.mjs:96-98`:
```js
test('#33 AC7: no production source imports the schema manifest', () => {
  const source = readFileSync(new URL('../src/houseplan-card.ts', ...), 'utf8')
    + readFileSync(new URL('../src/houseplan-editor-runtime.ts', ...), 'utf8');
  assert.ok(!source.includes('config-schema-manifest'), ...);
});
```
Манифест был переименован в коммите `f4318721` (`scripts/config-schema-manifest.json` →
`scripts/config-schema.json`, ровно из-за конфликта с глобом HACS `*manifest.json`), но
эта проверка по-прежнему ищет старую строку `'config-schema-manifest'`, которой больше
нет нигде в репозитории ни как файла, ни как валидного пути импорта.

**Воспроизведение (проверено исполнением, не чтением):** дописал в `src/houseplan-card.ts`
строку `fetch('./scripts/config-schema.json')` — реальный импорт манифеста под его текущим
именем — и перезапустил тест:
```
ok 3 - #33 AC7: no production source imports the schema manifest
```
Тест остался зелёным. AC7 («манифест не импортируется бандлом — контракт-проверка
отсутствия импорта») сегодня не проверяет вообще ничего: искомая строка не может
встретиться ни в каком корректном имени импорта.

Отдельно: проверка читает только 2 файла из ~60 в `src/**`, хотя и ТЗ («AC7-контракт
(нет импорта манифеста из src/\*\*)»), и план автотестов говорят про весь `src/**`. Реальную
защиту от роста бюджета сейчас даёт не этот тест, а эмпирический `npm run bundle:budget`
(прогнан лично, см. таблицу выше, budget соблюдён) — но именно регрессионный тест,
который должен ловить будущий случайный импорт, сегодня этого не делает.

**Правка:** искать актуальное имя (`config-schema.json` либо путь
`scripts/config-schema`) и читать весь `src/**` (например, `readdirSync` рекурсивно или
готовый список файлов сборки), а не два жёстко перечисленных файла.

### M2 — Дубликат записи в обоих CHANGELOG и в ARCHITECTURE.md

`docs/CHANGELOG.md:5-17`, `docs/CHANGELOG.ru.md:11-24`, `docs/ARCHITECTURE.md:1503-1550` — один и
тот же абзац/раздел присутствует **дважды подряд**, слово в слово.

**Причина, видна в истории:** `git diff 24681ee2 867f4762 --stat` показывает, что второй
`feat`-коммит (`867f4762`) добавил ровно те же 24/7/7 строк в
`ARCHITECTURE.md`/`CHANGELOG.md`/`CHANGELOG.ru.md`, которые первый (`24681ee2`) уже добавил —
похоже на случайное повторное применение шага «допиши changelog» при двух подряд идущих
коммитах с идентичным сообщением. Результат в `dev`-кандидате: пользователь, открывший
`CHANGELOG.md`, увидит одну и ту же строку изменений дважды подряд; `ARCHITECTURE.md` несёт
два одинаковых заголовка `## Schema as the source of truth (#33, 2026-08-30)`.

**Правка:** убрать вторую копию блока в каждом из трёх файлов (внутри этой же задачи —
Medium в скоупе, отдельный issue не заводится, #202).

### M3 — `config-audit.mjs` расширил exit-code 3 за пределы согласованного контракта, и для `decision-required` это семантически неверно

ТЗ ревизии 3 (согласовано в SPEC-REVIEW-33-r1/r2, зафиксировано в теле issue и в файле
ТЗ, Блок 3): «`3` — migration available (найдены поля со статусом
**migrate-\*/deprecated-read**)». Реализация (`scripts/config-audit.mjs:83-86`) добавляет
ещё два статуса в `MIGRATION_STATUSES`:
```js
const MIGRATION_STATUSES = new Set([
  'migrate-on-write', 'migrate-on-settings-save', 'deprecated-read',
  'drop-on-validation', 'decision-required',
]);
```
`drop-on-validation` (aspect/segments) можно защитить как «тоже legacy-остаток» — это в духе
контракта, хоть и не названо буквально. Но `decision-required` — это статус
`settings.group_lights` и `settings.exclude_integrations`
(`scripts/config-field-registry.mjs`): по собственному описанию регистри это ДЕЙСТВУЮЩИЕ,
поддерживаемые поля, чья судьба не решена архитектурно (issue #44), а не легаси-хвосты и
не что-то, что нужно мигрировать. Их `migration`-текст в registry прямо говорит: «decide
supported UI versus fixed exclusion rules before removal» — то есть миграции для
пользователя СЕГОДНЯ не существует вообще.

**Сценарий отказа:** владелец экспортирует у себя план, где реально используется
`settings.group_lights` (обычная включённая фича, не легаси), и прогоняет
`npm run audit:config -- house.json` для диагностики. Инструмент возвращает exit-код `3`
«migration available», хотя мигрировать почему-то нечего — поле продолжит жить как есть,
пока #44 не примет решение. Это вводит в заблуждение ровно того человека
(владельца/разработчика), для которого инструмент существует.

AC6 не ловит это: юнит-тест (`test/config-audit.test.mjs`) прогоняет только три фикстуры
Блока 3, ни одна из которых не содержит `group_lights`/`exclude_integrations`, поэтому
расширение осталось незамеченным собственным тестом задачи.

**Правка:** либо сузить `MIGRATION_STATUSES` до буквально согласованного набора
(`migrate-on-write`, `migrate-on-settings-save`, `deprecated-read`, и по желанию
`drop-on-validation` с явным примечанием почему), исключив `decision-required`; либо, если
разработчик хочет сохранить более широкий охват, обновить формулировку AC6/контракта в ТЗ
и явно объяснить, почему «decision-required» тоже сигнализирует «migration available» —
на сегодняшний день это фактически неверно для двух из четырёх статусов набора.

## Что проверено и корректно

- **AC1** (свежесть/детерминизм/полнота манифеста) — доказано исполнением:
  `python3 scripts/dump-config-schema.py --check` → `manifest fresh: 265 paths`;
  `tests_backend/test_config_schema_manifest.py::test_issue_33_manifest_is_fresh_and_deterministic`
  зелёный (byte-identical + `len(fields) > 200`). Дамп корректно fail-closed на
  незнакомые валидаторы (90/265 путей `opaque` — ожидаемо и не судится parity-тестом,
  риск явно назван в ТЗ).
- **AC2/AC3** (parity + анти-гниение allow-list) — зелёный тест, и я лично сверил все
  8 пар вручную по `custom_components/houseplan/validation.py` и итоговому
  `scripts/config-schema.json` (fill_mode ×2, display, tap_action, opening.type,
  trail_mode, zero_wall_style, bg_mode) — значения манифеста совпадают со схемой построчно.
  **Тест умеет падать**: мутант `schema-manifest-enum-drift` (фантомное значение в
  манифесте) поймал 1/1 при личном прогоне.
- **AC4** (полнота registry) — зелёный; вручную проверил трансляцию тегированных
  вариантов манифеста (`<furniture>`, `<partition>`) в нетегированные пути и совпадение
  с построением селектора из registry. **Тест умеет падать**: мутант
  `registry-selector-dead-decision` (испорченный selector) поймал 1/1.
  Новые записи (`decor_default_style`, `decor kind:'furniture'`,
  `openings[].host=partition`) резолвятся в реальные пути манифеста — проверено чтением
  и подтверждено прохождением самого AC4-теста (он бы упал на несуществующем пути).
- **AC5** (lossless фикстуры) — `tests_backend/test_config_schema_manifest.py::test_issue_33_lifecycle_fixtures_pass_the_schema_losslessly`
  зелёный на всех трёх фикстурах; потери ограничены задокументированными
  `spaces[].aspect`/`spaces[].segments` (vol.Remove). Дополнительно прогнал
  `npm run invariants` на всех трёх фикстурах — геометрические инварианты (разрешимость
  ссылок, ключ записи толщины = ключ решёточного ребра) не нарушены, только
  информационные наблюдения на exact-endpoints, не связанные с #33.
  `test_issue_33_future_fields_round_trip_exactly` зелёный — будущие поля на всех
  уровнях (root/settings/space/marker) переживают валидацию точно.
- **AC6** (exit-коды 0/3/2) — юнит зелёный на всех трёх кодах (см. M3 по существу
  контракта: коды технически работают, но множество триггеров шире согласованного).
- **AC7** (нет импорта в бандл, бюджет не растёт) — эмпирически подтверждено
  (`npm run bundle:budget` → 279147/300000, не изменилось от базовой линии — прирост
  бюджета отсутствует, манифест не тянется рантаймом); регрессионный тест-контракт
  сломан, см. M1.
- Регистри: `enforcedBy` у 4 реализованных механизмов подтверждён чтением кода
  (houseplan-card.ts материализация show_all, editor-runtime удаление weather_entity,
  normalizeDeviceDisplay + `_dropLegacySegments` для ripple, `vol.Remove` для
  aspect/segments) — соответствует находкам предыдущей ревизии владельца (актуализация
  бэклога 2026-08-30).
- Переименование манифеста (`f4318721`) применено последовательно везде, где он
  упоминается (dump-скрипт, allowlist, mutation-gate, оба теста, ТЗ, ARCHITECTURE.md) —
  кроме забытой строки в самом AC7-тесте (M1).
- Трейлеры всех 4 коммитов корректны (`Issue: #33` на каждом, `User-Visible: yes` на
  обоих `feat`, `no` на `fix`/`build`); оба changelog правлены в том же коммите, что и
  `feat` (хотя и с дублированием, см. M2).
- Класс D (`dist/**`, `custom_components/houseplan/frontend/**`) обновлён отдельным
  `build`-коммитом (`572cf928`), не смешан с продуктовым кодом — соответствует таблице
  классов AGENTS.md.
- Не-скоуп соблюдён: ни рантайм-поведение конфига, ни судьба
  `group_lights`/`exclude_integrations` (кроме паспорта) не тронуты; миграций и новых
  ключей i18n нет.

## Чего не проверял

- Полный `tests_backend` с реальной Home Assistant (нет `homeassistant`/`.venv-backend` в
  этой песочнице) — прогнан только новый файл задачи, который не требует HA.
- Полный набор мутантов (`node scripts/mutation-gate.mjs` без `--id`) — предрелизный
  гейт по объёму, прогнаны только два мутанта, введённых этой задачей.
- `golden:verify` и браузерные смоки сверх обоснованного выше — diff не меняет визуал,
  smoke-select не нашёл доказанной связи.
- Оговорённая вне скоупа судьба `group_lights`/`exclude_integrations` (#44) — не судил,
  это прямо не-скоуп ТЗ.

## Вердикт

Жёлтый. High: 0, Medium: 3, все в скоупе — правятся в этом же issue без нового
цикла-issue (#202). Ядро задачи (генерируемый манифест, parity+allow-list, полнота
registry, lifecycle-фикстуры, exit-коды) реализовано добротно и доказано
исполняемыми тестами, включая мутационное доказательство «тест умеет падать» для
AC2 и AC4. Три находки — тест, который не может поймать регрессию, которую он
называет своей целью (M1), задвоенная документация из-за дублирующего коммита (M2)
и семантически неточный exit-код для одного из двух «decision-required» полей (M3).
