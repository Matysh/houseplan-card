"""Конфигурация relay. Единственный источник — переменные окружения.

Секреты (токен доставки) читаются из ФАЙЛА, путь к которому задан переменной:
значение секрета не попадает ни в командную строку, ни в `systemctl show`,
ни в вывод `ps`.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# §7.5 ТЗ: вложение ≤ 8 MiB, весь запрос ≤ 8.5 MiB.
MAX_REQUEST_BYTES = 8 * 1024 * 1024 + 512 * 1024
MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
MAX_MESSAGE_CODEPOINTS = 10_000
MAX_CONTACT_CODEPOINTS = 320

# §9.2 ТЗ: 5 попыток в час и 20 в сутки на источник.
RATE_HOURLY = 5
RATE_DAILY = 20
# Глобальный предохранитель: столько принятых отчётов в час со всех источников.
RATE_GLOBAL_HOURLY = 60

IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60
RATE_TTL_SECONDS = 24 * 60 * 60


@dataclass(frozen=True)
class Config:
    port: int
    spool: Path
    mode: str               # 'deliver' | 'discard'
    channel: str            # 'telegram' | 'ha_webhook'
    enabled: bool
    retention_days: int
    telegram_token: str     # пусто = доставка выключена
    telegram_chat_id: str
    webhook_url: str        # адрес вебхука Home Assistant (секрет: он же ключ доступа)
    trusted_proxy: bool     # брать источник из X-Forwarded-For

    @property
    def delivers(self) -> bool:
        if self.mode != "deliver":
            return False
        if self.channel == "ha_webhook":
            return bool(self.webhook_url)
        return bool(self.telegram_token and self.telegram_chat_id)


def _read_secret(path_value: str) -> str:
    if not path_value:
        return ""
    path = Path(path_value)
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8").strip()


def load(env: dict[str, str] | None = None) -> Config:
    env = dict(os.environ if env is None else env)
    mode = env.get("HP_RELAY_MODE", "discard").strip().lower()
    if mode not in {"deliver", "discard"}:
        raise ValueError("HP_RELAY_MODE must be 'deliver' or 'discard'")
    channel = env.get("HP_RELAY_CHANNEL", "telegram").strip().lower()
    if channel not in {"telegram", "ha_webhook"}:
        raise ValueError("HP_RELAY_CHANNEL must be 'telegram' or 'ha_webhook'")
    spool = Path(env.get("HP_RELAY_SPOOL", "/var/lib/hp-support-relay"))
    return Config(
        port=int(env.get("HP_RELAY_PORT", "8130")),
        spool=spool,
        mode=mode,
        channel=channel,
        # Рубильник §19 ТЗ: выключенный relay обязан отвечать единообразным 503,
        # а не принимать отчёты и терять их.
        enabled=env.get("HP_RELAY_ENABLED", "1").strip() not in {"0", "false", "no"},
        retention_days=int(env.get("HP_RELAY_RETENTION_DAYS", "30")),
        telegram_token=_read_secret(env.get("HP_RELAY_TELEGRAM_TOKEN_FILE", "")),
        telegram_chat_id=env.get("HP_RELAY_TELEGRAM_CHAT_ID", "").strip(),
        webhook_url=_read_secret(env.get("HP_RELAY_WEBHOOK_URL_FILE", "")),
        trusted_proxy=env.get("HP_RELAY_TRUSTED_PROXY", "1").strip() not in {"0", "false", "no"},
    )
