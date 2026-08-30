# ТЗ #33 — Единый registry схемы и lifecycle compatibility-полей

- Issue: https://github.com/Matysh/houseplan-card/issues/33
- Приоритет: P2, tech-debt; полный трек (класс A schema-потребители — решение
  аналитики 2026-08-15, не оспаривается)
- Ревизия: 2 (2026-08-30) — актуализация после стабильной v1.69.0; замеры
  ревизии: CONFIG_SCHEMA = 212 листовых путей, LAYOUT_SCHEMA = 2,
  registry = 24 записи, parity/CI/фикстур нет

## Сценарий

Разработчик добавляет значение в enum на одной стороне (Voluptuous или
TypeScript) и забывает вторую — сегодня это молча живёт до полевого бага.
После задачи CI краснеет с понятным диффом («backend fill_mode знает 'glow',
frontend SPACE_FILL_MODES — нет: либо допиши, либо внеси в allow-list
компат-расхождений»). Владелец плана ничего нового не видит — задача не
меняет ни одного байта поведения конфига.

## Что человек увидит до и после

Ничего: чисто инженерная страховка. Единственный видимый след — CI-джоба,
падающая при дрейфе схемы, и `npm run config:audit`, который стал полнее.

## Проблема

Схема расползлась по четырём мирам (Voluptuous, TS-типы, const-списки
runtime, UI) и синхронизируется руками. Registry (24 записи) покрывает только
слой «компат-решений» и отстал даже в нём: 4 решения уже реализованы кодом
(show_all, weather_entity, ripple-канонизация, aspect/segments через
vol.Remove), а новые поля v1.68–v1.69 (decor_default_style, furniture-decor,
host=partition) не имеют паспорта. Полного манифеста persisted-путей нет;
узаконенные read-compat расхождения (fill_mode 'glow', display 'ripple',
tap_action 'cover') нигде не записаны машиночитаемо.

## Ключевое решение ревизии 2

Канонический манифест НЕ пишется руками на 212 путей — он **генерируется из
Voluptuous-схемы**: бэкенд — единственный владелец формы persisted-данных,
всё остальное сверяется с ним. Registry остаётся отдельным слоем решений
ПОВЕРХ манифеста. Судьбы `group_lights`/`exclude_integrations` решает #44 —
здесь они получают только паспорт ALLOW_EXTRA.

## Скоуп (три блока)

### Блок 1 — генерируемый манифест схемы

- `scripts/dump-config-schema.py`: обходит `CONFIG_SCHEMA`/`LAYOUT_SCHEMA`
  (Optional/Required, default, vol.In → enum, vol.Range → min/max,
  vol.Any → варианты, vol.Remove → отметка dropped, ALLOW_EXTRA → флаг узла)
  и пишет детерминированный `scripts/config-schema-manifest.json`
  (сортировка путей, стабильная сериализация). Импорт validation.py без
  homeassistant — заглушки родительских пакетов (приём проверен
  инвентаризацией этой ревизии).
- Манифест коммитится; pytest-тест регенерирует его в tmp и сравнивает
  байт-в-байт — рассинхрон схемы и манифеста ломает CI с diff-ом.

### Блок 2 — parity и полнота

- `test/config-schema-parity.test.mjs` читает манифест и сверяет enum-пары с
  const-декларациями фронта: fill_mode ↔ `SPACE_FILL_MODES`/`ROOM_FILL_MODES`,
  display ↔ `DISPLAY_MODES`, opening.type, tap_action ↔ `TAP_ACTIONS`,
  vacuum.trail_mode, zero_wall_style, bg_mode. Расхождение падает, если его
  нет в **машиночитаемом allow-list** `scripts/schema-compat-allowlist.mjs`
  (каждая запись: сторона-владелец, значение, причина, ссылка на issue).
  Стартовый allow-list: fill_mode 'glow' (backend-only, read-compat #20-эры),
  display 'ripple' (backend-only, канонизация в icon_ripple), tap_action
  'cover' (backend-only, read-compat).
- Тест полноты registry: каждый `id` из `config-field-registry.mjs`
  разрешается либо в путь манифеста, либо в явный extra-паспорт
  (`show_all`, `group_lights`, `exclude_integrations` — поля вне схемы,
  живущие через ALLOW_EXTRA; список — в registry новым полем
  `schema: 'allow-extra'`). Registry-запись, не находящая цель, ломает тест
  (мёртвые решения не накапливаются).
- Актуализация registry как данных: 4 реализованных решения переводятся в
  статус `implemented` (show_all, weather_entity, ripple, aspect/segments);
  новые паспорта — `settings.decor_default_style` (v1.69, supported),
  `decor kind:'furniture'` (v1.69, supported), `openings[].host=partition`
  (v1.68 model v9, supported). Registry по-прежнему НЕ зеркалит все 212
  путей — только поля с нетривиальной судьбой; полноту обычных полей несёт
  манифест.

### Блок 3 — фикстуры lifecycle

- `test/fixtures/config-lifecycle/`: три фикстуры — oldest-supported
  (легаси-поля: show_all, weather_entity, display 'ripple', walls-проекция),
  current (срез v1.69 с decor_default_style/furniture/value_source),
  future (незнакомые поля на всех уровнях).
- pytest: каждая проходит CONFIG_SCHEMA; future-поля переживают валидацию
  losslessly (ALLOW_EXTRA-контракт), legacy не отбрасывается кроме
  задокументированных vol.Remove.
- Юнит фронта: `config-audit.mjs` на этих фикстурах даёт ожидаемые counts
  (clean / migration available), exit-codes различимы — расширение
  существующего test/config-audit.test.mjs.

## Не-скоуп

- Изменение поведения ЛЮБОГО поля, новые миграции, изменение схемы.
- Судьба `group_lights`/`exclude_integrations` (это #44).
- Автогенерация TS-типов из манифеста (возможный будущий шаг).
- Optimize-превью миграций (существующий механизм не трогается).
- Числовые range-сверки фронта (у фронта нет машиночитаемых range-деклараций;
  манифест их несёт, сверка появится вместе с декларациями).

## Контракт поведения

Ничего в рантайме не меняется. Новые артефакты: манифест (JSON),
allow-list (mjs), дамп-скрипт (py), два теста, фикстуры, паспорта в registry.

## UX / i18n

Не задето. Новых строк нет.

## Модель данных и миграция

Persisted-данные не меняются. Манифест — build-артефакт в git, не в бандле
(бюджет initial не растёт).

## Критерии приёмки

- **AC1**: `scripts/config-schema-manifest.json` детерминирован (два прогона
  дампа байт-идентичны) и покрывает 100% листовых путей CONFIG/LAYOUT-схем;
  pytest падает при рассинхроне схемы и закоммиченного манифеста, diff
  показывает пути.
- **AC2**: parity-тест зелёный на текущем дереве; добавление значения в
  бэкенд-enum без пары и без allow-записи → красный с именем enum и значением
  (доказательство мутантом м1).
- **AC3**: удаление записи allow-list при сохранённом расхождении → красный
  (расхождения не узакониваются молча).
- **AC4**: тест полноты registry зелёный; запись с несуществующей целью →
  красный (мутант м2: сломать selector одной записи).
- **AC5**: все три фикстуры проходят схему; future-поля возвращаются из
  валидации без потерь (pytest, сравнение по путям).
- **AC6**: `config-audit.mjs` различает exit-codes на фикстурах (юнит).
- **AC7**: полный гейт зелёный; бюджет initial без изменений (манифест не
  импортируется бандлом — контракт-проверка отсутствия импорта).

## План автотестов

- pytest: AC1 (свежесть манифеста), AC5 (фикстуры) — в tests_backend
  (обходчик без homeassistant, работает и в песочнице).
- node --test: AC2/AC3 (parity + allow-list), AC4 (полнота registry),
  AC6 (audit exit-codes), AC7-контракт (нет импорта манифеста из src/**).
- Мутанты (mutation-gate): м1 — подмена одного enum-списка фронта
  (убрать значение из DISPLAY_MODES-копии проверяемой пары) → красный AC2;
  м2 — испортить selector одной registry-записи → красный AC4.

## Риски

- Дамп-скрипт может отставать от новых конструкций Voluptuous (Coerce,
  кастомные валидаторы): fail-closed — незнакомый валидатор пишется в
  манифест как `opaque` с исходным repr, тест свежести это переживает,
  parity такие узлы не судит.
- Ложные срабатывания parity на легитимных решениях — гасятся allow-list'ом
  с обязательной причиной и ссылкой.
- CI-время: дамп-регенерация — миллисекунды (walk по объектам в памяти).

## Откат

`git revert`: все артефакты — новые файлы + паспорта-данные в registry;
рантайм не тронут, откат ничего не теряет.

**DoR-примечания:** миграция/compatibility — нет (только чтение схемы);
touch — не влияет; производительность — не влияет (build/test-time).

## Release-артефакты

- CHANGELOG + CHANGELOG.ru: короткая запись (инфраструктура защиты схемы),
  User-Visible: yes у финального коммита (пользователь получает гарантию
  «старый конфиг не портится молча», это честно назвать).
- docs/ARCHITECTURE.md: абзац «схема как источник истины: манифест,
  parity, allow-list» со ссылками на скрипты.

## Принятые предположения

- Бэкенд-схема — единственный канонический источник формы persisted-данных;
  фронтовые типы — потребители (соответствует факту: все записи идут через
  config/set с валидацией).
- Card-level Lovelace-поля (fit, light_pools, show_button…) — НЕ persisted
  store и в манифест не входят; их учёт — вне скоупа (при желании — отдельный
  issue).
- Registry остаётся «слоем решений», а не зеркалом схемы, — по исходной
  шапке файла; полноту несёт манифест.
