# Код-ревью #799 — ожидание длительного сбора Zigbee2MQTT

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0.

## Материал и разрешение

- Issue: https://github.com/Matysh/houseplan-card/issues/799, `track:show`.
- База: `e69b3f2009c531fbd138efbc2eeb51a364c4fae6`.
- Продуктовый SHA: `0f77b921f66f0fb3104a3e473247a811581b9d64`.
- 12 файлов, 185 добавленных и 12 удалённых строк. Терминальные трейлеры
  `Issue: #799`, `User-Visible: yes` и оба changelog присутствуют.

Владелец разрешил исправление и немедленную экспресс-бету с минимальными
локальными проверками. Внешняя модель недоступна: автор выполнил самопроверку,
отдельный локальный агент `/root/zigbee_timeout_backend`, не писавший патч,
прочитал весь дифф и подтвердил SHA перед финальным вердиктом. Это не вердикт
модели конвейера. [Разрешение и план](https://github.com/Matysh/houseplan-card/issues/799#issuecomment-5995516221).

## Результат независимого чтения

Скоуп — J7: явно запущенное получение топологии Zigbee. Нет новых настроек,
автоматических сканирований, миграций и изменений ZHA.

`src/zigbee-topology-runtime.ts` вычисляет общий deadline 600 секунд один раз
до подписок. Каждая подписка и MQTT publish ограничены меньшим из 10 секунд
и остатка общего бюджета; retained bridge-info сохраняет 4 секунды.
Отдельный cap publish не ограничивает десятью секундами ожидание карты.
Promise вложенного timeout включён в Promise.all, необработанного отклонения нет.

Сохранены routes:true, transaction, дедупликация connection/topic, guards
преждевременных/retained/чужих/поздних ответов, late-unsubscribe cleanup,
старый snapshot и timestamp со stale при ошибке, повторный явный запрос.
Число транспортного cap имеет один источник Z2M_TRANSPORT_TIMEOUT_MS.
Четыре локали и обе пользовательские документации согласованы с 600 секундами.

## Проверки

Node 22.23.2, Windows. Ревьюер не дублировал исполнение: проверил сценарии и
assertions чтением, результаты переданы автором и тестовым агентом.

| Гейт | Результат |
| --- | --- |
| 4 Zigbee unit-suite | 57/57 PASS |
| Runtime-suite отдельно | 19/19 PASS |
| Регрессия AC1 на старом runtime, транспилированном из Git в памяти | RED: на виртуальных 150 секундах error вместо loading |
| typecheck, build | PASS |
| bundle-policy --verify на продуктовом SHA | PASS: свежая сборка цела, 42 ассета |
| demo/smoke_zigbee_topology_hover.mjs | PASS, все флаги true |
| smoke-select | Единственная зарегистрированная связь — указанный smoke; выполнен |
| git diff --check | PASS, также исполнено независимым ревьюером |

Первый smoke отказал из-за stale demo; доказательством является последующий
PASS после bundle-sync. Generated bundles очищены перед продуктовым коммитом.

## AC: чем краснеет

| AC | Доказательство | Отрицательный случай |
| --- | --- | --- |
| AC1 | production timeout accepts … after 180 seconds | Старый runtime прекращает ожидание на 150 секунде, тест ждёт loading и затем ready на 180-й |
| AC2: общий предел | ten-minute budget includes subscription setup… | Границы 599999/600000 мс; 18 секунд setup входят в общий бюджет, поздний callback не меняет revision |
| AC2: транспорт | Два subscription-теста и publish stops after ten seconds… | 9999/10000 мс; поздний unsubscribe очищается; ранняя карта не обходит зависший publish |
| AC2: info | retained bridge confirmation… | 3999/4000 мс; нет publish; поздний retained callback не оживляет операцию |
| AC2: сохранённые guards | Старые #798 runtime-тесты и новые cache/retry assertions | Чужая transaction, retained, поздний ответ, stale timestamp, совпадающий promise concurrent-вызовов |
| AC3 | 4 suites, build/typecheck, smoke, независимое чтение | Права/ZHA/конфиг не меняются, длительность обновлена во всех локалях |

## Риски и ограничения

Async/MQTT и кеш покрыты AC1/AC2. Геометрия, ввод и отрисовка маршрутов не
затронуты. Реальное радиооборудование пользователя не проверялось: 10 минут —
ограниченный бюджет, не обещание завершения любой сети. Прекращение ожидания
House Plan не отменяет скан внутри Z2M.

Полный локальный npm test, backend/HA и полные smoke/golden/performance не
выполнялись по express-разрешению. Штатный full Validate точного SHA кандидата
остаётся отдельным условием публикации. Этот отчёт не подтверждает его заранее.
