# House Plan support relay

Приёмщик обезличенных отчётов «Помощь и обратная связь» (#43, §9 ТЗ
[043](../../docs/specs/043-private-support-report.md)). Отдельно разворачиваемый
сервис: в артефакт HACS не входит, в карточку не собирается.

Два маршрута и ни одного лишнего:

| Маршрут | Назначение |
|---|---|
| `POST /v1/reports` | приём отчёта (multipart: часть `request` + необязательная `attachment`) |
| `GET /health` | режим, состояние рубильника, срок хранения |

## Почему без зависимостей

Сервис написан на стандартной библиотеке Python 3.12. Причина не в аскезе: это
публичный эндпоинт без общего секрета с клиентом, и любая зависимость на нём —
это чужой код, за обновлениями которого придётся следить вечно ради пяти
запросов в час. Отсутствие зависимостей делает установку копированием каталога,
а ревью — чтением четырёхсот строк.

## Как устроена защита

Общего секрета у открытого клиента быть не может (§9.2 ТЗ), поэтому защита
стоит на трёх опорах, и каждая проверяется тестами:

1. **Схема.** Неизвестная часть multipart, неизвестное поле в `request`,
   неизвестная секция в пакете, чужой `format`, вложенный multipart, повтор
   части — отказ. Не «игнорируем лишнее», а именно отказ.
2. **Размер.** `Content-Length` больше 8,5 МиБ отвергается **до** чтения тела;
   вложение сверяется с заявленными длиной и sha256 и разбирается как JSON.
3. **Частота.** 5 попыток в час и 20 в сутки на источник плюс общий
   предохранитель 60 в час на узел.

Адрес источника нигде не хранится: он превращается в HMAC от секрета узла и
сегодняшней даты, ключ живёт сутки. Штатный логгер `BaseHTTPRequestHandler`
заменён — он печатал адрес клиента.

Сообщение и контакт нормализуются и очищаются от управляющих символов, включая
маркеры двунаправленного письма: доставка выводит их буквальным текстом без
разметки, поэтому подделать вид сообщения нельзя.

## Доставка

Канал — Telegram (решение владельца 2026-09-01): сводка сообщением, пакет —
документом. `parse_mode` не используется намеренно, текст пользователя
отображается буквально. Ответ провайдера наружу не отражается: клиент получает
только `report_id` либо стабильный код отказа.

Отчёт кладётся на диск **до** попытки доставки. Если доставка не удалась,
клиент получает retryable `support_unavailable`, а обращение остаётся на узле —
терять его нельзя.

`HP_RELAY_MODE=discard` (staging) принимает и складывает отчёт, но никуда его не
отправляет. Это и есть эндпоинт для CI без production-доставки.

## Коды ответа

| HTTP | Тело | Когда |
|---|---|---|
| 200 | `{"report_id": "hpr-…"}` | принято; повтор с тем же `idempotency_key` вернёт тот же id и `"duplicate": true` |
| 400 | `support_rejected` / `support_invalid_message` | схема, размерность полей, хеш, пустое сообщение |
| 413 | `support_package_too_large` | запрос или вложение больше лимита |
| 429 | `support_rate_limited` | исчерпан лимит источника или узла |
| 503 | `support_unavailable` | рубильник выключен либо доставка не удалась |

## Переменные окружения

См. `deploy/env.example`. Секрет доставки задаётся **путём к файлу**
(`HP_RELAY_TELEGRAM_TOKEN_FILE`), а не значением: так он не виден ни в
`systemctl show`, ни в `ps`, ни в дампе окружения.

## Установка

```bash
sudo useradd --system --home-dir /var/lib/hp-support-relay --shell /usr/sbin/nologin hprelay
sudo mkdir -p /opt/hp-support-relay /etc/hp-support-relay /var/lib/hp-support-relay/{prod,staging}
sudo rsync -a --delete scripts/support-relay/ /opt/hp-support-relay/
sudo chown -R hprelay:hprelay /var/lib/hp-support-relay
sudo chmod 700 /var/lib/hp-support-relay/{prod,staging}

sudo cp deploy/hp-support-relay@.service deploy/hp-support-relay-purge@.service \
        deploy/hp-support-relay-purge@.timer /etc/systemd/system/
sudo install -m 0640 -o root -g hprelay deploy/env.example /etc/hp-support-relay/prod.env
# staging: HP_RELAY_MODE=discard, HP_RELAY_PORT=8131, свой спул
sudo systemctl daemon-reload
sudo systemctl enable --now hp-support-relay@prod hp-support-relay@staging
sudo systemctl enable --now hp-support-relay-purge@prod.timer hp-support-relay-purge@staging.timer
```

Затем добавить `deploy/Caddyfile.fragment` в `/etc/caddy/Caddyfile` и
`sudo systemctl reload caddy`. **Reload, а не restart**: валидный конфиг с
недоступным доменом уронит сервис при рестарте, тогда как reload оставит
работать прежний.

## Runbook

**Проверить состояние**

```bash
curl -s https://support.houseplan.tech/health
systemctl status hp-support-relay@prod
journalctl -u hp-support-relay@prod -n 50
```

**Выключить приём** (§19 ТЗ — откат начинается отсюда)

```bash
sudo sed -i 's/^HP_RELAY_ENABLED=1/HP_RELAY_ENABLED=0/' /etc/hp-support-relay/prod.env
sudo systemctl restart hp-support-relay@prod
```

Выключенный relay отвечает единообразным 503 и **не принимает** отчёты. Это
важнее, чем кажется: принять и потерять — хуже, чем честно отказать, потому что
пользователь считает обращение отправленным.

**Сменить токен доставки**

```bash
sudo install -m 0400 -o hprelay -g hprelay /dev/stdin /etc/hp-support-relay/telegram.token
sudo systemctl restart hp-support-relay@prod
```

**Прочитать обращение**

```bash
sudo -u hprelay ls /var/lib/hp-support-relay/prod/reports/*/
sudo -u hprelay cat /var/lib/hp-support-relay/prod/reports/2026-09/hpr-…/report.json
```

**Срок хранения.** Таймер `hp-support-relay-purge@prod.timer` ежедневно удаляет
отчёты старше `HP_RELAY_RETENTION_DAYS` (30) и метаданные частоты и
идемпотентности старше суток. Проверить вручную:
`sudo -u hprelay HP_RELAY_SPOOL=… python3 /opt/hp-support-relay/relay.py purge`.

## Тесты

```bash
cd scripts/support-relay && python3 -m unittest discover -s tests -q
```

Тридцать проверок: схема, размеры, хеш, идемпотентность, частота, ретеншн,
буквальность текста, отсутствие адреса в журналах, поведение рубильника.
Каждая проверялась отрицательным прогоном — десять мутаций рабочего кода
(снять сверку хеша, разрешить лишнюю часть, не чистить управляющие символы,
снять лимит, писать адрес в журнал, игнорировать идемпотентность, отключить
рубильник, отключить ретеншн, не проверять секции пакета) роняют ровно те
проверки, ради которых написаны.
