# Независимое локальное код-ревью #800 — r3

Вердикт: зелёный · заход r3 · блокирующих циклов 2/4 · High: 0 · Medium: 0 · Low: 0 · маршрут: fix.

## Материал раунда

- Дата: 2026-10-05. Независимый код-ревьюер: `/root/code_review_800`,
  не автор ТЗ, ревью ТЗ или продуктовой реализации.
- Предыдущий раунд: [CODE-REVIEW-800-r2.md](CODE-REVIEW-800-r2.md), SHA
  `4a7abf531bc9bf750073fb7ac7f4a1d9777e83ed`.
- Итоговый материал: `07c885435aa6ba8e0dafecf6e06f722f4818202b`;
  дерево `158399fd47ecd4db4d262e14ed068dea7ce66305`.
- Дельта: `git diff 4a7abf531..07c885435` — 9 файлов,
  200 добавленных и 11 удалённых строк, включая отчёт r2/INDEX.
- Продуктовая правка находится в `67af859e8c28bb80cb294bdbb2b0062c0aad0099`.
  Следующий коммит `07c885435` меняет только fixture в
  `demo/smoke_zigbee_topology_hover.mjs`; отсутствие product/backend delta
  проверено `git diff --quiet 67af859e..07c885435 -- src custom_components tests_backend`.
- HEAD и чистота рассматриваемых product/test путей повторно сверены перед
  итогом. Терминальные трейлеры обоих коммитов корректны; продуктовая правка
  содержит оба changelog, fixture-only коммит — `User-Visible: no`.

ТЗ не менялось. Разбор по дельте PROCESS §2.10: исправление временного
capability-отказа и его async-соседей, плюс корректность fixture. Новых
подсистем, геометрии, радио-команд и продуктового скоупа нет. Основание
локального порядка — [разрешение владельца для #800](https://github.com/Matysh/houseplan-card/issues/800#issuecomment-5998860326).
Ревьюер не правил продукт, не запускал мутанты, не делал commit/push,
не менял issue/метки и не выполнял merge/release.

## Закрытие M1 из r2

`capability()` теперь сохраняет ссылку на ожидаемый Promise, а при отказе
очищает `cache.capability` **только если это всё ещё тот же Promise**
(`src/zigbee-topology-runtime.ts:151–159`). Отказ пробрасывается текущему
действию; автоматического повторного чтения или публикации нет. Следующее
явное действие делает новое чтение. Проверка identity не позволяет позднему
отказу старой сессии стереть более свежую проверку.

Новый unit `#800 explicit retry recovers after config not_ready during
same-WS integration reload` воспроизводит полный сценарий r2: closed →
явный start/not_ready → готовый replacement → явный retry → новая подписка
и новый job → streamed result. Проверяются числа чтений, публикаций,
дедупликация одновременных действий и отсутствие auto-retry между действиями.

Ревьюер повторил свою production-source пробу r2 без записи файлов:
после временного отказа `config reads=2`, `server starts=1`, phase error;
после явного retry на восстановленном backend — `config reads=3`,
`server starts=2`, phase loading, `jobId=new-job`. На материале r2 этот же
сценарий оставался в error с 2/1. **M1 закрыта.**

Зарегистрирован guard
`zigbee-background-reload-error-poisons-explicit-retry`: он компилирует
production TypeScript перед unit и убирает очистку rejected capability.
Статическая проверка якоря зелёная; исполнение мутанта остаётся ночи.

## Отдельно: гонка старой hover-fixture

На `67af859e` снова воспроизвёлся timeout проверки искусственного возраста
ZHA. Fixture ждала текст `backend_required`, уже сохранённый от прежнего
наблюдателя; новая проверка capability могла ещё завершиться и заменить
локально подставленный snapshot обычным runtime notification.

Коммит `07c885435` учитывает реальные незавершённые `config/get` вызовы,
ждёт их завершения, одну очередь event loop и `updateComplete`, и лишь затем
ставит age-fixture. Нет увеличения smoke timeout или изменения product timer.
Оставлены assertions fresh → stale и `zhaCalls === 1`; добавлена проверка,
что итоговый `obtainedAt` равен точному подставленному времени. То есть
ожидаемый пользовательский исход не ослаблен.

Исправленный fixture прошёл два предварительных прогона и отдельный прогон
на итоговом exact-SHA после его сборки. Первоначальный красный прогон не
переименован в зелёный: зелёным является именно исправленный материал.

## Проверки

| Команда / проверка | Результат и источник |
| --- | --- |
| `git diff --check 4a7abf531..07c885435` | PASS, ревьюер |
| `node --test test/zigbee-topology-runtime-routes.test.mjs test/zigbee-topology.test.mjs test/zigbee-provider-routes.test.mjs test/zigbee-topology-style.test.mjs` | 57/57 PASS, исполнено ревьюером; эти product/test файлы после `67af859e` не менялись |
| `node scripts/mutation-gate.mjs --check` | PASS, ревьюер; прежние 4 предупреждения inventory, мутанты не исполнялись |
| `npm run gate:small` на чистой WSL-копии exact `67af859e` | PASS, все 9 шагов, 77 с; прочитан `C:/Temp/hp800-gate-small-wsl-r3.log` |
| `npm run gate:small` повторно на exact `07c885435` | PASS, все 9 шагов, 71 с; прочитан `C:/Temp/hp800-gate-small-wsl-final.log`. Build/typecheck, npm test, integrity/budget, no-new-any/private-writes, smoke-select, lint:unused |
| `python -m pytest tests_backend -q --tb=short` с coverage в HA harness | 1007 PASS, 1 SKIP, 24,96 с; прочитан `C:/Temp/hp800-backend-coverage-r3.log`. По проверке автора line coverage 88,93% при floor 87,2%; Python в этой дельте не менялся |
| `node demo/smoke_zigbee_topology_job.mjs` | 18/18 PASS; прочитан `C:/Temp/hp800-smoke-job-r3.log`. Включены временный not_ready и следующий явный retry на том же WS |
| `node demo/smoke_general_settings_form.mjs` | 30/30 PASS; прочитан `C:/Temp/hp800-smoke-general-r3.log` |
| `node demo/smoke_zigbee_topology_hover.mjs` на exact `07c885435` | PASS; прочитан `C:/Temp/hp800-smoke-hover-exact-final.log`; все итоговые флаги true |
| Визуальное чтение новых артефактов production settings | Ревьюер просмотрел `narrow-light-wait.png`, `narrow-dark-wait.png`, `desktop-ready.png` из `/home/matysh/hp800-final-oct5/artifacts/zigbee-topology-800/`: действия/подсказки не обрезаны, waiting/ready различимы, cancel виден |
| Независимая production-runtime проба из r2 | PASS на новом runtime, результат 3 чтения / 2 публикации / новый job после явного retry |

WSL-команды и browser прогоны исполнял автор, ревьюер изучил указанные логи,
assertions и изображения; это не выдаётся за собственный второй полный
прогон. Exact-SHA исходная копия — `/home/matysh/hp800-final-oct5`, Node
22.23.2, HA 2026.8.3. Backend/новый job/general smoke относятся к
`67af859e`; их исполняемые входы не менялись в fixture-only `07c885435`.
Полный дешёвый гейт и исправленный hover дополнительно повторены именно на
последнем SHA.

smoke-select снова перечисляет те же 14 имён. Решения по каждой строке
находятся в [r1](CODE-REVIEW-800-r1.md) и не изменились: два Zigbee smoke
применимы и исполнены; совпадения общих имён lifecycle/snapshot/keyOf не
означают изменения независимых геометрических/dialog подсистем. Полная
матрица остаётся предрелизной обязанностью.

## Защитные AC, затронутые дельтой

| AC / защита | Доказательство | Чем краснеет |
| --- | --- | --- |
| AC2/AC4/AC6: явный retry после временного reload-отказа | Новый runtime unit, production-source probe, browser `retryDuringReloadDoesNotStartRadioOrDisableRetry` и следующий new-session assertion | `zigbee-background-reload-error-poisons-explicit-retry`; exact reads/publications/job/result не допускают старый cached rejection |
| Нет авто-скана/авто-retry | Тот же unit и browser smoke | Между отказом и новым действием publications остаётся 1 в unit / 2 в smoke; setup сам число чтений не увеличивает |
| Старый async ответ не ломает нового владельца | Сохранённые 4 reload/ACK/foreign-closed/inflight tests из r2, все 57 unit зелёные; чтением identity guard capability Promise | Foreign/stale событие не меняет revision; old finally/ACK не удаляет новую команду/feed; новый cache не очищается чужим rejected Promise |
| AC6: возраст ZHA без нового чтения | Исправленный hover smoke | Сначала fresh, затем stale при единственном `zha/devices`; точный `ageFixtureTime` не заменён runtime notification |

## Унаследовано из r2 и r1

Из [r2](CODE-REVIEW-800-r2.md) на `4a7abf531bc9bf750073fb7ac7f4a1d9777e83ed`
приняты без нового полного разбора закрытия r1 M2/M3/L1: event-loop witness
600/900 секунд и его mutant, backend closed/same-socket lifecycle, разрешение
metadata/registry/bundle gate, документация RU/EN/STATUS и обоснованная база
размера. Эти механизмы дельта не меняет; обязательные гейты всё равно повторены.

Из [r1](CODE-REVIEW-800-r1.md) на `379de706d29f4b1547c3b162c1c205654487c6b8`
унаследованы J7/скоуп, admin-only, topic/transaction/retained guards,
ограниченные ресурсы, last-good/stale, 599/600 cancel/id/race, provider error
и MQTT disconnect, optional MQTT/API floor, отсутствие persisted runtime,
ZHA cached read и неизменность маршрутов/LQI, локали и единый elapsed formatter.

Новых находок нет. Числа и пользовательский сценарий имеют те же источники,
новой миграции/геометрии/постоянного polling нет. Полная радиосеть владельца,
реальный touch/скринридер, полный golden/performance и GitHub Validate/артефакты
кандидата беты этим отчётом не проверены. Локальное код-ревью завершено;
зелёный вердикт разрешает следующий процессный шаг, но не подтверждает заранее
факт merge или публикации.
