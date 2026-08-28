# ТЗ #340 — обязательная ревизия для повторной записи config/set

- Issue: https://github.com/Matysh/houseplan-card/issues/340
- Тип: баг / технический долг
- Приоритет: P3
- Трек: полный — меняется публичный WebSocket- и compatibility-контракт,
  риск потери данных выше 3
- Связанные задачи: #220 — штатная запись порядка пространств с ревизией;
  #224 — stale CAS не становится no-op

## 1. Сценарий

Владелец или администратор редактирует один общий план в двух вкладках, на
двух устройствах либо оставляет надолго открытую вкладку со старой копией.
Один клиент уже сохранил изменение. Второй клиент, который не передал ревизию
прочитанного конфига, пытается записать свою полную копию поверх новой.

Этот же контракт относится к стороннему WebSocket-клиенту администратора и к
очень старому закэшированному bundle карточки. Обычный актуальный frontend уже
передаёт `expected_rev` через единственную транспортную точку записи.

## 2. Что человек увидит до и после

До изменения устаревшая вкладка может молча стереть более новую работу; после
изменения сервер отвергнет такую запись как конфликт, а сохранённый план
останется без изменений.

В актуальной карточке сохраняется существующее поведение конфликта: сообщение о
том, что конфиг изменён в другом окне, загрузка актуального состояния и просьба
повторить действие. Новый экран, диалог или настройка не появляются.

## 3. Проблема и подтверждённое состояние

`ws_config_set` принимает `expected_rev` как optional. Под `write_lock` он
сравнивает переданное значение с текущей ревизией, но при отсутствии поля над
ненулевой ревизией только пишет warning и продолжает полную замену конфига.
Это fail-open обход уже существующего optimistic-locking контракта.

Подтверждено на `origin/dev` перед началом задачи:

- актуальный frontend содержит ровно один `houseplan/config/set` и передаёт в
  нём `expected_rev: this._cfgRev`;
- параметр и обработка `conflict` существуют с v1.4.4;
- проверка ревизии атомарна, потому что выполняется внутри `write_lock`;
- стабильный публичный код ошибки называется `conflict`, а не
  `config_rev_conflict`;
- `docs/ARCHITECTURE.md` и `docs/TESTING.md` всё ещё описывают отсутствие
  ревизии как разрешённый warning-only путь.

Сервер не получает достоверную версию клиента или иной выданный при чтении
write token. Поэтому запись без ревизии нельзя одновременно разрешить
«легаси-клиенту» и безопасно отличить от stale writer: это один и тот же
запрос. Версионное окно, сохраняющее запись поверх ненулевой ревизии, сохраняло
бы исходный дефект.

## 4. Цели

1. Закрыть отсутствие `expected_rev` как обход optimistic locking для любого
   уже сохранённого конфига.
2. Сохранить стабильный `conflict`-контракт и существующую обработку актуальной
   карточкой.
3. Оставить безопасный bootstrap пустого store без ревизии для установки или
   совместимого административного клиента.
4. Защитить единственную frontend-точку записи исполняемым inventory guard.
5. Не менять stored config, его model/store version и пользовательский UI.

## 5. Не-цели

- не менять `layout/set`, `layout/update`, import/optimize и их собственные CAS;
- не вводить `client_version`, epoch, сессию редактирования или merge конфига;
- не пытаться автоматически повторить потерянное пользовательское действие;
- не добавлять серверную телеметрию, rate limiter или новую настройку;
- не менять разрешения: записывать конфиг по-прежнему может только
  администратор;
- не исправлять сторонние клиенты, которые никогда не читали или не сохраняли
  ревизию.

## 6. Контракт поведения

### 6.1 Матрица config/set

| Текущая ревизия store | `expected_rev` | Результат |
|---:|---|---|
| `0` | отсутствует | bootstrap принимается; после успешной записи ревизия становится `1` |
| `0` | `0` | запись принимается по обычному CAS |
| `N > 0` | отсутствует | `conflict`; config/rev/backup/event и файловая уборка не меняются |
| `N` | `N` | обычная валидация; успешная запись или canonical no-op |
| `N` | любое другое число | `conflict`; сохранённое состояние не меняется |

Bootstrap-исключение безопасно и при двух одновременных клиентах: первый запрос
коммитит `rev=1` под `write_lock`, а второй после получения того же lock уже
попадает в строку `N > 0` и отклоняется.

### 6.2 Порядок guard-ов и атомарность

1. Действующие permission/runtime и `MAX_CONFIG_BYTES` guard-ы сохраняют
   приоритет и текущее поведение.
2. Проверка наличия/совпадения ревизии выполняется внутри `rt.write_lock`
   непосредственно после загрузки store и до CPU-валидации кандидата.
3. При ненулевой текущей ревизии отсутствие поля эквивалентно stale CAS и
   возвращает `connection.send_error(..., "conflict", ...)`.
4. Текст ошибки однозначно сообщает, что клиент не передал ожидаемую ревизию и
   должен перечитать конфиг; текущая ревизия может быть показана, поскольку
   endpoint доступен только администратору.
5. Отказ происходит до любых изменений `msg["config"]`, записи backup/store,
   сброса optimizer snapshot, junction cache, plan collection и события
   `houseplan_config_updated`.
6. Совпадающий с хранимым payload без `expected_rev` при `current_rev > 0` тоже
   получает `conflict`: canonical no-op не является обходом CAS.
7. Для диагностируемости сохраняется warning с текущей ревизией и причиной
   отказа, но в нём нет конфига, user data или токенов.

Voluptuous-поле остаётся `vol.Optional("expected_rev")`, чтобы bootstrap
оставался валиден и чтобы отсутствие ревизии возвращало стабильный доменный
код `conflict`, а не общий schema/format error. На уровне семантики повторной
записи поле обязательно.

### 6.3 Клиент и конфликт

Актуальный frontend не получает нового пути: `_sendConfigCandidate()` как и
сейчас передаёт `_cfgRev`, обновляет его только после успеха, а существующий
обработчик `conflict` показывает `toast.conflict` и перечитывает серверный
конфиг. Новый i18n-ключ не требуется.

Исполняемый inventory в `scripts/coordinate-write-barrier-guard.mjs` должен не
только доказывать единственность и canonicalization `config/set`, но и требовать
`expected_rev` в том же outbound message. Появление новой прямой точки записи
без CAS должно ломать unit gate.

### 6.4 Совместимость старых клиентов

- `expected_rev` является частью штатного frontend-контракта с v1.4.4;
- очень старый или сторонний клиент без поля может один раз инициализировать
  пустой store (`rev=0`);
- такой клиент не может менять уже сохранённый план: он получает `conflict` и
  должен обновиться либо реализовать `config/get → config/set(expected_rev)`;
- временное принятие blind write поверх `rev>0` запрещено: без дополнительного
  аутентифицированного маркера возраст клиента неразличим со stale write;
- downgrade storage/config не требуется, чтение старым клиентом не меняется.

Это намеренное fail-closed завершение compatibility window, а не миграция
документа. Безопасность сохранённой работы важнее поддержки клиента,
предшествующего базовому CAS-контракту.

## 7. UX, i18n и touch

Новых элементов интерфейса нет. В актуальной карточке используются существующие
ключи:

- EN: `toast.conflict`;
- RU: `toast.conflict`;
- DE и последующие локали используют тот же уже существующий ключ.

Прямой WS-клиент получает код `conflict` и английский backend message, как и
при несовпавшей явной ревизии.

View/kiosk и touch gestures не меняются. Контракт touch-first усиливается:
открытый планшет не может молча затереть правку с desktop. Редакторы остаются
desktop-first, но safety floor из `docs/TOUCH-SUPPORT.md` запрещает потерю
данных и соблюдается одинаково на всех устройствах.

## 8. Модель данных и миграция

- новых persisted-полей и compatibility-полей нет;
- `rev` остаётся метаданными store, `expected_rev` — полем WS-запроса;
- model/store/export version не меняются;
- чтение и запуск интеграции не переписывают данные;
- успешный bootstrap и обычная запись используют существующий save path;
- отклонённая запись не создаёт миграцию, backup или новую ревизию.

`docs/CONFIG-COMPATIBILITY.md` фиксирует bootstrap-only совместимость старого
wire-контракта и отсутствие безопасного версионного окна для blind writes.

## 9. Производительность, безопасность и наблюдаемость

Положительный путь получает одну дешёвую проверку наличия ключа, уже рядом с
существующим сравнением integer. Новый I/O, сериализация или проход по конфигу
не добавляются. Отрицательный путь становится дешевле, потому что завершается
до executor validation.

Изменение закрывает целостность данных, но не является security-boundary:
endpoint остаётся admin-only. Нельзя включать содержимое конфига в warning.
Отдельные performance capture, security scan и telemetry artifact не нужны.

## 10. Затронутые файлы и модули

- `custom_components/houseplan/websocket_api.py` — fail-closed guard;
- `tests_backend/test_ha_websocket.py` — bootstrap, missing-rev conflict,
  неизменность store/rev/event;
- `scripts/coordinate-write-barrier-guard.mjs` и существующий unit-тест —
  обязательный `expected_rev` во frontend inventory;
- `docs/ARCHITECTURE.md` — WS API и optimistic-locking contract;
- `docs/CONFIG-COMPATIBILITY.md` — bootstrap-only legacy compatibility;
- `docs/TESTING.md` — заменить warning-only expectation;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — несколько клиентов и
  необходимость актуальной карточки;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — пользовательская запись;
- `docs/specs/README.md` — связь issue ↔ ТЗ.

Frontend product code и словари i18n не меняются.

## 11. План автотестов

### 11.1 Backend HA websocket

1. На пустом store `config/set` без `expected_rev` успешно создаёт `rev=1`.
2. Второй клиент отправляет отличающийся config без `expected_rev`, получает
   `conflict`; последующий `config/get` возвращает первый config и `rev=1`.
3. Отсутствующая ревизия с byte/semantic-equivalent payload при `rev=1` тоже
   получает `conflict`, без save/event/backup side effect.
4. Повтор с явным `expected_rev=1` принимается; stale explicit rev по-прежнему
   получает `conflict`.
5. `caplog` подтверждает диагностический warning без сериализованного конфига.

Тест использует две WebSocket-сессии либо эквивалентно доказывает две
последовательные записи под общей runtime/store authority. Проверка хранит
отличимый marker/space payload, чтобы исключить ложный успех no-op.

### 11.2 Frontend inventory

`test/coordinate-write-barrier-guard.test.mjs` проходит для production source и
падает на fixture/source mutation, если единственный `config/set` больше не
содержит `expected_rev` рядом с canonical candidate.

### 11.3 Регрессия

- существующий `test_config_rev_conflict` остаётся зелёным;
- targeted backend test file проходит в HA harness;
- `npm test`, `npm run build`, `npm run docs:accept` — по локальному гейту
  процесса;
- полный backend suite и обычные CI gates — на review/merge pipeline.

## 12. Критерии приёмки

| AC | Проверяемое условие | Доказательство |
|---|---|---|
| AC1 | Первый `config/set` без rev на пустом store допустим, но любая следующая запись без rev получает `conflict` | backend HA websocket test |
| AC2 | Missing-rev conflict не меняет config, rev, backup и не публикует `houseplan_config_updated`, включая semantic no-op payload | backend HA websocket test со spy store/event bus |
| AC3 | Два конкурентных клиента не могут применить две blind writes: после первого коммита второй без rev отклоняется | backend HA websocket test с двумя клиентами/общим runtime |
| AC4 | Точный explicit rev сохраняет текущий success/no-op contract, устаревший explicit rev сохраняет `conflict` | существующий и расширенный backend tests |
| AC5 | В production frontend существует ровно один `config/set`, он canonical и всегда содержит `expected_rev` | executable coordinate writer guard + unit negative fixture |
| AC6 | Публичная документация больше нигде не обещает warning-only blind overwrite и описывает bootstrap-only compatibility | `npm run docs:accept` + ревью кода |
| AC7 | UI, i18n, config schema/model/export version, View/kiosk/touch и положительный write-path не меняются | typecheck/build + ревью кода |

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Очень старый cached bundle больше не может сохранить существующий план | CAS доступен с v1.4.4; fail-closed error, документация просит обновить карточку; bootstrap остаётся |
| Общий schema error сломает обработчик конфликта | поле остаётся Optional, handler явно возвращает стабильный `conflict` |
| No-op превратится в обход CAS | revision guard выполняется до canonical/semantic no-op |
| Второй bootstrap успеет записать поверх первого | load/check/save сериализованы одним `write_lock`; backend test двух клиентов |
| Warning раскроет или размножит пользовательские данные | логировать только факт и integer rev; config/payload запрещены |
| Новый frontend writer забудет CAS | executable inventory guard ломает unit gate |

## 14. Откат

Кодовый откат — вернуть warning-only ветку для отсутствующего `expected_rev`.
Миграция назад не нужна: изменение ничего не записывает и не меняет формат.
Такой откат снова открывает подтверждённую потерю данных и допустим только как
аварийный временный шаг с отдельным issue; feature flag не нужен.

## 15. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: коротко сообщить, что старая
  вкладка/клиент больше не может молча перезаписать новый конфиг, ссылка #340;
- обновить architecture, compatibility, testing и обе user-guide локали по
  §10;
- screenshots/golden не нужны: визуал не меняется;
- performance capture не нужен: нет render/runtime cost;
- отдельный security artifact не нужен; backend tests являются доказательством
  fail-closed целостности;
- commit trailer реализации: `Issue: #340`, `User-Visible: yes`.

## 16. Принятые предположительно технические решения

Эти решения не требуют продуктового ответа владельца и могут быть изменены
ревьюером при сохранении AC:

1. Использовать существующий код `conflict`, не вводить новый error code.
2. Оставить schema field optional ради bootstrap и доменного error response.
3. Считать `rev=0` единственным безопасным legacy compatibility window.
4. Расширить существующий coordinate writer inventory вместо создания второго
   скрипта с дублирующим поиском frontend writers.
