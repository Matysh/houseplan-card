# Независимое локальное код-ревью #800 — r1

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 3 → в задаче · Low: 1 · маршрут: fix.

## Материал раунда

- Дата: 2026-10-05. Ревьюер: отдельный агент `/root/code_review_800`, не автор
  ТЗ, не ревьюер ТЗ и не исполнитель реализации.
- Issue: [#800](https://github.com/Matysh/houseplan-card/issues/800), `track:ask`.
- Ветка: `issue/800-zigbee-background-scan`.
- База: `1faed2af7d89f768e7fd15a55489c5f8317f7032`.
- Продуктовый материал: `379de706d29f4b1547c3b162c1c205654487c6b8`.
  26 файлов, 2294 добавленных и 784 удалённых строки. SHA повторно проверен
  перед составлением вердикта. Трейлеры `Issue: #800`, `User-Visible: yes`
  и оба changelog находятся в продуктовом коммите.
- ТЗ: полное тело issue, сверенное с переданным `hp800-spec.md`; SHA-256
  нормализованного тела из принятого ТЗ:
  `de6f7a8816ce796cb3f53713838505a66a5b098d986cf39d56f9e8ec74a55d09`.

Локальный независимый порядок разрешён владельцем
[только для #800](https://github.com/Matysh/houseplan-card/issues/800#issuecomment-5998860326).
Это не результат штатной модели и не подтверждение CI/слияния/выпуска.
Ревьюер не менял продукт, метки, GitHub, коммиты или ветки.

Во время разбора автор отдельно поправил только гонку фикстуры в
`demo/smoke_zigbee_topology_hover.mjs`: ожидание `backend_required` перед
искусственной подстановкой возраста ZHA. Прочитан незакоммиченный diff;
SHA-256 файла `332f80111ee4c3f06e2a18643cbee11eaaf08460102aa2e6444daf9364d13d96`.
Он не подменяет материал `379de706d`. Generated `dist/` после гейта также
не входит в рассматриваемый продуктовый коммит. Последующие исправления
находок этого отчёта требуют r2 по дельте.

## Скоуп и способ проверки

Работа обслуживает J7: пространственную диагностику Zigbee. Прочитаны новый
coordinator/WS, lifecycle интеграции, frontend runtime/settings/overlay,
тесты, локали, изменения документации и декларации мутантов. Алгоритмы
маршрутов/LQI и сохранённая геометрия не меняются.

| Проверка | Результат и происхождение |
| --- | --- |
| `git diff --check 1faed2af..379de706d` | PASS, исполнено ревьюером |
| `node --test test/zigbee-topology.test.mjs test/zigbee-topology-runtime-routes.test.mjs test/zigbee-provider-routes.test.mjs test/zigbee-topology-style.test.mjs` | 52/52 PASS, исполнено ревьюером на подготовленном `test-build`; полный typecheck/build — ниже |
| `node scripts/mutation-gate.mjs --check` | PASS, исполнено ревьюером; предупреждения существующего browser inventory. Мутанты не исполнялись по PROCESS §2.7 |
| `npm run gate:small` | FAIL, полный лог автора `C:/Temp/hp800-gate-small.log` прочитан ревьюером: 3612 PASS, 6 FAIL, 62 SKIP; отдельно FAIL `lint:unused` по bundleBytes. Детали M3 |
| `npm run typecheck`, `npm run bundle:sync` | PASS по переданному автором результату; build/typecheck также прошёл до unit-стадии полного гейта |
| `/home/matysh/houseplan-card-576-final/.venv-ci/bin/python -m pytest tests_backend/test_ha_zigbee_topology.py -q --tb=short` | 32 PASS по результату backend-исполнителя; HA 2026.8.3 / pytest-homeassistant-custom-component 0.13.357, WSL Ubuntu |
| Тот же Python: `-m pytest tests_backend -q --tb=short` | 1007 PASS, 1 SKIP по результату backend-исполнителя; не нативный Windows pure-only прогон |
| `/home/matysh/houseplan-card-576-final/.venv-ci/bin/ruff check custom_components/houseplan` | PASS по результату backend-исполнителя |
| Node 22.23.2: `node demo/smoke_zigbee_topology_job.mjs` | 15/15 PASS по результату автора в `/home/matysh/hp800-6yPzWT`; ревьюер прочитал assertions и просмотрел narrow light/dark PNG |
| `node demo/smoke_general_settings_form.mjs` | 30/30 PASS по результату автора |
| `node demo/smoke_zigbee_topology_hover.mjs` | Первоначально FAIL на искусственном возрасте; после указанного выше fixture-only изменения PASS по результату автора. Не считать исходный smoke зелёным на неизменённом материале |
| Reload-проба текущего production runtime | FAIL ожидаемого восстановления, исполнено ревьюером без изменения файлов; M1 |

WSL-проверки исполнителя запускались через `wsl -d Ubuntu --cd
/home/matysh/hp800-6yPzWT -- ...`. Эта копия содержала актуальные файлы, но её
Git HEAD оставался базовым: это локальное доказательство исполнения файлов,
не exact-SHA CI attestation. Backend-логи ревьюером повторно не исполнялись;
числа переданы исполнителем и не выдаются за собственный прогон.

### smoke-select

Исполнена команда `node scripts/smoke-select.mjs --base
1faed2af7d89f768e7fd15a55489c5f8317f7032 --head
379de706d29f4b1547c3b162c1c205654487c6b8`: 12 прямых и 2
зарегистрированных совпадения. Решения перечислены полностью:

| Строка выборки | Решение |
| --- | --- |
| `smoke_zigbee_topology_hover`, `smoke_zigbee_topology_job` | Применимы; результаты выше |
| `smoke_bg_color` | Не исполнен: совпало общее имя `_snapshot`, фон не менялся |
| `smoke_danger_confirm_branches`, `smoke_dialog_help_clipping`, `smoke_dialog_modal_recovery`, `smoke_ha_form_shell_parity`, `smoke_preloader_lifecycle`, `smoke_space_card_bg`, `smoke_summary_dialog_scroll` | Не исполнены: совпало общее имя `connectedCallback`; соответствующие компоненты не менялись. Общие настройки дополнительно покрыты профильным smoke |
| `smoke_support_feedback` | Не исполнен: `errorCode` здесь локальная функция другого модуля, support не менялся |
| `smoke_warm_owners` | Не исполнен: совпало общее имя `disconnectedCallback`; lifecycle самого Zigbee проверяется профильным smoke/runtime suite |
| `smoke_resize_pointer_real_plan`, `smoke_resize_wall_thickness` | Не исполнены: связь по удалённому локальному `keyOf` Zigbee совпала с независимым геометрическим символом; resize не менялся |

Полная smoke-матрица остаётся предрелизной проверкой. Этот отчёт не объявляет
неисполненные строки зелёными.

## Находки

### M1 — живой браузер остаётся на умершем job после reload интеграции

`custom_components/houseplan/zigbee_topology.py:422–436` очищает `_listeners`
без сообщения существующим WS-наблюдателям. При reload только интеграции
соединение HA WebSocket остаётся открытым. Frontend сохраняет `unsubscribe`
старого coordinator и старый `session`; `startFeed` не создаёт новую подписку,
пока старый unsubscribe существует, а `accept` отбрасывает ответ команды
нового coordinator как чужую сессию (`src/zigbee-topology-runtime.ts:102,
142, 169–172`).

Воспроизведение: оставить настройки/overlay подписанными, запустить scan,
reload интеграции без перезагрузки браузера. Старое ожидание продолжает
рисоваться, «Обновить карту» остаётся disabled. После 600 секунд отмена
старого id получает `conflict`, который frontend намеренно игнорирует.
Даже явный start нового job из того же runtime не принимается клиентским
кешем. Закрытие одних настроек не помогает, пока overlay удерживает общий feed.

Ревьюер исполнил непереписывающую Node-пробу: production TypeScript
транспилирован в памяти, принят `old-job`, затем смоделирована фактическая
очистка listener при смене coordinator, вызваны cancel и start новой сессии.
Вывод: после reload `phase: loading`, `jobId: old-job`, `serverStarts: 2`,
`observers: 0`. Контракт §4.7/§6 и AC4/AC6 нарушен.

Нужно передать клиенту инвалидирование старой серверной сессии и обеспечить
восстановление наблюдения после reload, без автоматического сканирования.
Нужен тест с подписанным клиентом до reload и тем же живым WS после него.
Нынешний backend unload-тест до выгрузки вообще не подписывается.

### M2 — AC1 не имеет свидетеля, чувствительного к прежнему 600-секундному deadline

`tests_backend/test_ha_zigbee_topology.py:142–147, 175–219` изменяет только
импортированные `zigbee.monotonic` и `zigbee.time`. `clock.now += 600/300`
не продвигает `hass.loop.time()` и очередь `asyncio`-таймеров. Следовательно,
добавление прежнего общего `asyncio.timeout(600)` вокруг ожидания карты не
успеет сработать в этом тесте: он всё равно получит немедленный fake ответ
и будет зелёным. Frontend smoke также продвигает число в fake server state,
а не backend deadline.

Чтением подтверждено, что нынешний `_run` общего таймаута не содержит; это
не доказательство требуемой регрессии. AC1 прямо требует отрицательную пробу
прежнего лимита, а PROCESS §2.7 — названный свидетель защиты. Соответствующей
декларации в `scripts/mutation-registry.mjs` нет.

Нужно управлять реальным временем event loop/запланированными timeout callbacks
в witness и зарегистрировать мутацию восстановления общего deadline. Мутант
в этом цикле не запускать: его исполнение остаётся ночи.

### M3 — материал не проходит обязательный gate:small

В прочитанном полном логе есть относящиеся к новому материалу отказы:

- `test/data-hp-contract.test.mjs`: шесть новых `zigbee-scan-*` хуков не
  объявлены публичными или внутренними.
- `test/reviews-index.test.mjs`: `PREFLIGHT-SPEC-800.md` не соответствует
  схеме имён; индекс новых review-документов не приведён в согласованное состояние.
- `test/smoke-select.test.mjs`: новые backend `.py` пути в `SMOKE_LINKS`
  нарушают существующую схему `src/*.ts`.
- `lint:unused`: `bundleBytes` 2 696 965 против базы 2 686 188, рост 10 777 Б
  при полосе 2 000 Б. Не приложено требуемое обоснование/согласованная база.

Это воспроизводимый отказ обязательного AC-гейта, не допустимое умолчание
перед merge. Исправить декларации и размер/его процессное обоснование,
повторить полный gate в каноническом окружении. Три остальных Windows-отказа
(`dev-build`, `nightly-workflow`, `iso-overlay-fixture-types`) отдельно
не объявляются продуктовыми регрессиями #800: требуется результат Linux/WSL,
но нельзя заранее засчитать их зелёными.

### L1 — English guide всё ещё обещает прекращение ожидания через 10 минут

`docs/USER-GUIDE.md:347` по-прежнему говорит «House Plan waits up to 10 minutes».
Это прямо противоположно новой функции. ТЗ §10 требует USER-GUIDE RU/EN и
STATUS; English guide и STATUS не изменены. Исправить вместе с возвратом
задачи; это не основание расширять продуктовый скоуп.

## AC и «чем краснеет»

| AC | Чем доказан / граница доказательства | Чем краснеет |
| --- | --- | --- |
| AC1 | Чтением отсутствие scan deadline; backend `test_issue_800_background_15_minutes_two_clients_and_reopen` доказывает elapsed/приём ответа без UI, но не прохождение реального deadline | Недостающий отрицательный witness прежнего лимита — M2 |
| AC2 | Backend two-clients/reopen; frontend `one shared feed`, `late 15m result`; browser reload | Повтор start обязан оставить publications=1; detach обязан оставить server job живым; cleanup mutant `zigbee-topology-z2m-subscriptions-leak` |
| AC3 | Backend cancel-boundary/old-id/race; frontend 599/600/hours, cancelled-last-good; keyboard smoke | 599 отказ / 600 разрешение, старый id при уже cancellable новом job; мутанты `zigbee-background-stale-cancel-affects-new-job`, `zigbee-background-cancel-too-early` |
| AC4 | Runtime ownership/late-ack/identity tests; browser elapsed/one subscription/detach/admin loss; просмотр light/dark PNG | Late callback после detach, stale action response, identity replacement не должны менять новый snapshot. Reload живого WS не покрыт и сломан — M1 |
| AC5 | HA permission/topic/retained/foreign/oversize/invalid-shape/instant-error/disconnect/timeout/capacity/teardown tests; frontend old-backend test | Реальные non-admin WS отказы; неверная transaction/retain/oversize сохраняют last-good; 9-й active slot отвергнут; registry `zigbee-topology-z2m-foreign-response-accepted`, `zigbee-topology-z2m-malformed-response-waits-for-timeout`; timeout/disconnect negative cases в тестах |
| AC6 | 52 unit PASS включая прежние route fixtures, ZHA cached read; чтением отсутствие сериализации runtime; backend unload очищает runtime | ZHA asserts точный `zha/devices` и никогда radio update; мутант `zigbee-topology-zha-read-starts-scan`; frontend forbidden MQTT call; integration reload клиента требует M1 |

## Что корректно и что не проверялось

Корректны по чтению и названным тестам: резервирование job до async работы,
один запрос на topic, transaction/job-id isolation, admin-only WS независимо
от editor policy, bounded payload/slots, last-good/stale, очистка поздних
subscribe acknowledgements, немедленная correlated provider error даже внутри
publish, отсутствие frontend MQTT fallback и отсутствие автоматических retry.
ZHA, resolver routes/LQI и persisted store version не переписаны.

Число, видимое на обеих UI-поверхностях, — elapsed: обе вызывают один
`zigbeeScanElapsedMs` и `formatZigbeeScanElapsed`. Сервер авторитетен по
600-секундному порогу, передаёт `cancel_after_ms`; frontend fallback не
ослабляет серверный guard. Нет ежесекундной передачи карты.

На заявленном HA floor наличие `ConfigEntry.async_create_background_task`
и MQTT connection-status API сверено чтением официального
[HA 2024.6.4 config_entries](https://github.com/home-assistant/core/blob/2024.6.4/homeassistant/config_entries.py)
и [MQTT module](https://github.com/home-assistant/core/blob/2024.6.4/homeassistant/components/mqtt/__init__.py).
Отсутствие необязательного readiness helper отдельно моделируется тестом;
полный запуск старого HA не выполнялся.

Риски: async/data/permissions/host lifecycle применимы и рассмотрены;
геометрия не менялась, invariants не требуются. Визуал ограничен настройками;
narrow light/dark изображения просмотрены, cancel не обрезан. Touch editor:
not exposed; новые настройки доступны touch, целевой размер проверен smoke,
настоящий touch-device/экранный диктор не испытывались. Работа диктора
проверена только чтением `role=status` и `aria-live=off` у таймера.

Реальная сеть владельца из 67 устройств, Linux full Validate точного SHA,
полная smoke/golden/performance матрица и выпуск не проверялись. Это не
обещание скорости радио-сканирования Z2M. Golden не назначен ТЗ/меткой;
runtime-кеш ограничен чтением/тестами, отдельный performance benchmark не
назначен. До закрытия M1–M3 зелёный вердикт и merge невозможны.
