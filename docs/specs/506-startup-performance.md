# #506 — Запуск карточки без повторного layout из-за lazy summary runtime

Issue: [#506](https://github.com/Matysh/houseplan-card/issues/506).
Дата: 2026-09-09. Полный трек: нарушен критерий small «нет влияния на производительность».
Статус и актуальный вердикт находятся только в issue.

## 1. Пользователь и сценарий

J1/J2/J3 из `docs/SCOPE.md`: владелец, член семьи и гость быстро открывают
план на desktop, телефоне или киоске, видят целостный план и текущее состояние
устройств. Администратор также переключает View/редакторы без скачков камеры.

До: повторное открытие карточки иногда создаёт ненужные тяжёлые перерисовки
сразу после первого кадра; обновление света попадает на повторное согласование
размеров. После: уже загруженный код сводной панели доступен новому экземпляру
до первого измерения шапки. Функции, настройки и внешний вид не меняются.

## 2. Доказательства и границы вывода

Full Performance [34335024892](https://github.com/Matysh/houseplan-card/actions/runs/34335024892)
сравнил `fff171c7dc3994bd884d95b812bd82b16b69f080` (продукт v1.72.0)
и `d11f95bc40ea5ba6749ea3290b241b30f02998a6` (неопубликованный stable-кандидат).
На каждом профиле база и кандидат запускались на одном Linux-runner:
7 образцов после 1 прогрева.

| Профиль / метрика | База | Кандидат | Допустимый предел |
|---|---:|---:|---:|
| blend, stateUpdate1 median ms | 49.9 | 130.4 | 99.9 |
| blend, longTask.countP95 | 2 | 5 | 4 |
| overlay, stateUpdate1 median ms | 217.3 | 808.8 | 325.95 |
| overlay, longTask.totalP95 ms | 1142 | 1735 | 1713 |
| isometric, longTask.countP95 | 23 | 29 | 27.6 |

Независимая неизменённая Linux-пара blend повторила 50.3 → 146.1 ms
при пределе 100.3 ms. Во всех семи образцах первый HA tick у базы вызывает
один `performUpdate`, у кандидата — четыре. Внешняя диагностическая трасса:

1. Новый экземпляр принимает warm snapshot и сохранённую высоту шапки.
2. `_summary` ещё отсутствует: даже прогретый модуль подключается через
   асинхронный `import().then()` в `connectedCallback`.
3. Первый render/`updated` измеряет шапку без summary controls.
4. Подключение summary добавляет controls; stage меняется 782 → 724 px.
5. Отложенный `_refitView` создаёт continuity-кандидат `stage-resize` и ещё
   три render-прохода holding/candidate/commit. Проверки `_booting=false` и
   `continuity=steady` в начале tick не исключают уже ожидающий refit.

Glow benchmark по контракту исключает mount cost, но исправляется именно
ненужный layout продукта, а не окно замера. Изометрический benchmark намеренно
включает load: уникальный title каждого sample даёт новый config/warm key.
Его JS-модуль прогрет, но card boot холодный. Load long tasks выросли с 3 до
6–9; повторный structural rebuild не обнаружен. Общая причина правдоподобна,
но весь прирост isometric пока НЕ доказан как summary-owned.

## 3. Объём задачи

Включены:

- загрузчик/фабрика summary runtime и её подключение к lifecycle карточки;
- устранение позднего header roundtrip у экземпляров с уже загруженным модулем;
- доказательства независимости карточек и корректной отмены отложенного подключения;
- узкие unit/browser/mutation проверки и неизменённые performance-пары.

Не включены: общий рефакторинг #500, новые функции панели, изменение её дизайна,
опций, доступности или прав; backend/config миграции; изменение геометрии света;
переписывание continuity/camera; удаление из замеров load, увеличение budgets,
сокращение samples или arbitrary sleeps. Другой источник регресса, не связанный
с этой цепочкой, требует отдельного явно согласованного расширения/issue.

## 4. Контракт загрузки и владения

### 4.1. Код отдельно от состояния

Допустим кеш успешно загруженного конструктора или фабрики **кода** в пределах
страницы/модуля. Новый host всегда получает новый runtime. Нельзя кешировать
между карточками host, controller/runtime instance, HA данные, user/card identity,
настройки, drafts, DOM, подписки, таймеры, observers, metrics или viewport.

Если фабрика уже доступна, runtime нового host создаётся синхронно при подключении
после `super.connectedCallback()`, до первого Lit render/измерения header.
Восстановление warm frame и cold card boot с прогретым модулем получают одинаково
полный состав summary controls. Существующий instance при same-node reconnect
переиспользуется, а не создаётся заново.

Первый cold load сохраняет динамическую границу: loaded runtime и его зависимости
не переносятся eager в entry bundle. Одновременные cold mounts могут разделять
один pending import, но не instance. Каждый host подключает только свой runtime.

### 4.2. Асинхронный lifecycle

Pending import после disconnect не должен подключить runtime к отключённому
host, вызвать новые UI side effects или восстановить старый host после его замены.
Повторный connect во время pending import не создаёт duplicate runtime/connect.
Завершение старой попытки не перезаписывает уже созданный instance и не запускает
второй connect поверх актуального lifecycle.

Успешный импорт можно сохранить как фабрику независимо от того, остался ли
его инициатор подключён. Ошибка загрузки не должна навсегда кешировать отказ:
следующая штатная попытка подключения может повторить импорт. Автоматический
бесконечный retry, новые сообщения пользователю и обязательный page reload не нужны.
Сохранить существующее безопасное поведение карточки при невозможности загрузить
опциональный runtime. Инвалидирование snapshot/subscription membership при первом
создании runtime должно сохраниться: новые summary entities не теряют live updates.

### 4.3. Layout и визуальная непрерывность

При неизменных host/chrome/config и прогретой фабрике первый показанный кадр имеет
полный header; его высота и stage совпадают с окончательными размерами. Не должно
быть второго summary-driven header measurement/refit/continuity-кандидата после
готовности плана. На детерминированном glow fixture первый неизменяющий геометрию
HA tick снова даёт один `performUpdate`, без наложенного stage-resize каскада.

Настоящий resize, поздний HA chrome, изменение ширины/высоты контейнера, видимости
панели и переход редактора не подавляются. Сохраняются viewport/zoom, warm identity,
обработка zero-size и hidden tab, current-token checks, complete-frame handoff,
paint barrier и существующий режим восстановления подключения.
`_refitView` и continuity state machine не изменяются для обхода этого регресса.

## 5. UX, данные, совместимость

Новых кнопок, строк, настроек и пользовательских решений нет; i18n не затрагивается.
Сводная панель остаётся lazy; её prefs и drafts принадлежат конкретному runtime.
Внешний вид, анимации, overlay layout, accessibility и desktop-first редакторы
соответствуют `UX-MODES.md`, `TOUCH-SUPPORT.md` и действующему #505.
Модель хранения, config version и сетевые API неизменны, миграция не нужна.
Смена пользователя, placement/card identity или маршрута не получает состояние
другого экземпляра через фабрику. Холодная страница и загрузка после ошибки остаются
работоспособными. Работа не должна увеличить eager bundle сверх текущего бюджета.

## 6. Критерии приёмки и доказательства

| AC | Ожидание | Доказательство |
|---|---|---|
| AC1 | Прогретая фабрика синхронно создаёт отдельный runtime для каждого нового host; same-node reconnect сохраняет свой instance | Unit loader/factory: два host, distinct instances, повторное подключение; browser assertion до первого render |
| AC2 | Cold concurrent mounts не дублируют импорт; ошибка допускает retry; pending disconnect/reconnect не даёт duplicate connect или stale side effects | Управляемые deferred promise unit tests success/failure/disconnect/reconnect, плюс browser lifecycle |
| AC3 | Нет cross-card/user preferences, drafts, DOM/подписок; подключение не теряет summary entity invalidation | Существующие summary runtime identity/live-state tests + новые assertions владения; разные host/card/user cases |
| AC4 | При width 780 px и длинном title warm replacement не даёт позднего summary/header roundtrip: первый полный header и stage стабильны, нет stage-resize кандидата при неизменной геометрии | Детерминированный browser smoke: покадровые размеры, runtime presence, refit/continuity/render counters; новый cold-key экземпляр с прогретым модулем тоже проверяется |
| AC5 | Первый HA brightness tick без изменения геометрии не имеет startup resize каскада | Browser smoke на измеряемом glow fixture, ожидается один performUpdate и отсутствие stage-resize; исходная paired benchmark trace |
| AC6 | Реальные resize/поздний chrome, View/все редакторы, скрытая/показанная панель, kiosk/dashboard/panel host и zero-size сохраняют поведение без пустого кадра | Warm-remount/preloader/continuity/summary/mode browser suite; хотя бы один положительный resize witness в новом smoke; CDP screencast |
| AC7 | Исходные blend, overlay и isometric проходят все текущие paired performance checks | Linux 7 samples + 1 warmup, неизменные scripts/windows/budgets, база fff171c7 или эквивалентный продукт v1.72.0; isometric load включён полностью |
| AC8 | Итоговый релиз имеет полные неизменённые gates, а узкий тест действительно ловит дефект | Negative witness: отключение synchronous cached path проваливает новый smoke; зарегистрированная mutation; Full Validate + все 9 Full Performance profiles на итоговом SHA |

Список файлов тестов — ориентир, а не требование менять каждый из них:
`summary-panel-runtime.test`, `boot-soft-layout.test`, `visual-continuity.test`,
`smoke_warm_remount`, `smoke_preloader_lifecycle`, `smoke_visual_continuity`,
summary/mode/viewport smoke и `smoke_isometric_contract`.
Защитный browser AC4/AC5 включается в `scripts/mutation-gate.mjs` с фактическим
negative witness; source-text assertion без исполнения недостаточен.

## 7. Техническая гипотеза, риски и откат

Предпочтительный дизайн: небольшой typed loader с factory cache + pending import,
per-host lifecycle guard и синхронный fast path в connectedCallback. Точные имена
и границы модуля допускается уточнить в реализации при сохранении контракта.
Static import loaded runtime вместо lazy factory недопустим.

Риски: двойное подключение при overlapping promises; кеширование failure;
утечка host/state; поздняя invalidation summary entities; незаметный перенос
runtime в eager chunk; исправление только glow без устранения isometric regression.
Первые риски закрываются AC1–AC6 и bundle checks. Последний — обязательным AC7;
если гипотеза не закрывает isometric, stable остаётся заблокирован, результаты
фиксируются в issue, бюджеты не ослабляются. Ретраи не заменяют объяснение причины.

Откат: revert scoped commit, данные совместимы в обе стороны. При возврате
регресса stable не публиковать; не откатывать публичные теги и не очищать prefs.

## 8. Документация и release artifacts

- Оба changelog: `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, ссылка #506;
  пользовательское исправление — более стабильное/быстрое открытие плана.
- `docs/ARCHITECTURE.md`: код фабрики кешируется на страницу, runtime/state —
  на экземпляр, cold lazy boundary и lifecycle guard. При необходимости уточнить
  `docs/WARM-REMOUNT.md`; пользовательское руководство не меняется (UX прежний).
- Новые визуальные эталоны дизайна не требуются: ожидаем тот же итоговый вид.
  Если src меняет docs fingerprint, перед релизом переснять полный набор в Linux,
  выполнить визуальную приёмку manifest/screenshots по действующему docs-процессу,
  не принимать автоматически и не исключать свидетелей без отдельного основания.
- Приложить unit/typecheck/build/smoke/mutation evidence, before/after paired JSON,
  Linux Full Performance и CDP continuity artifact с exact SHA/окружением.
- Версии/собранные полные bundle trees обновляются штатным release-процессом.
  После S8 выпускается новая бета, затем stable только после всех gates.
  Ни наличие предыдущего failed candidate в main, ни зелёный beta smoke не заменяет
  сравнение итогового stable с продуктом v1.72.0 и полную проверку всех 9 профилей.
