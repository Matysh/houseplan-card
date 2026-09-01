"""Частотные ограничения без хранения сырых адресов (§9.2 ТЗ).

Адрес источника нигде не сохраняется: он превращается в HMAC от секрета узла и
СЕГОДНЯШНЕЙ даты. Ключ живёт максимум сутки и не позволяет связать обращения
разных дней между собой; секрет узла генерируется при первом старте и лежит
рядом со спулом с правами 0600.
"""

from __future__ import annotations

import hmac
import json
import os
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from . import config

HOUR = 3600
DAY = 24 * 3600


class RateLimited(Exception):
    """Источник или узел исчерпал лимит."""


def _now() -> float:
    return time.time()


def node_secret(spool: Path) -> bytes:
    path = spool / "node.secret"
    if path.exists():
        return path.read_bytes()
    spool.mkdir(parents=True, exist_ok=True)
    secret = os.urandom(32)
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(secret)
    tmp.chmod(0o600)
    tmp.replace(path)
    return secret


def source_key(secret: bytes, address: str, now: float | None = None) -> str:
    """Дневной непрозрачный ключ источника: сырой адрес не возвращается никогда."""
    day = time.strftime("%Y-%m-%d", time.gmtime(_now() if now is None else now))
    return hmac.new(secret, f"{day}|{address}".encode("utf-8"), sha256).hexdigest()[:32]


@dataclass
class _Bucket:
    stamps: list[float]

    def prune(self, now: float) -> None:
        self.stamps = [stamp for stamp in self.stamps if now - stamp < DAY]


class Limiter:
    def __init__(self, spool: Path) -> None:
        self._dir = spool / "rate"
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, key: str) -> Path:
        return self._dir / f"{key}.json"

    def _load(self, key: str) -> _Bucket:
        path = self._path(key)
        if not path.exists():
            return _Bucket([])
        try:
            return _Bucket(list(json.loads(path.read_text(encoding="utf-8"))))
        except (OSError, ValueError):
            return _Bucket([])

    def _save(self, key: str, bucket: _Bucket) -> None:
        path = self._path(key)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(bucket.stamps), encoding="utf-8")
        tmp.chmod(0o600)
        tmp.replace(path)

    def check_and_count(self, key: str, now: float | None = None) -> None:
        """Считает попытку и бросает RateLimited, если лимит исчерпан.

        Попытка считается ДО доставки: иначе отправитель, добивающийся отказа,
        получал бы бесплатные повторы.
        """
        moment = _now() if now is None else now
        with self._lock:
            for name, limit, window in (
                (key, config.RATE_HOURLY, HOUR),
                (key, config.RATE_DAILY, DAY),
                ("_global", config.RATE_GLOBAL_HOURLY, HOUR),
            ):
                bucket = self._load(name)
                bucket.prune(moment)
                recent = [stamp for stamp in bucket.stamps if moment - stamp < window]
                if len(recent) >= limit:
                    raise RateLimited(name)
            for name in (key, "_global"):
                bucket = self._load(name)
                bucket.prune(moment)
                bucket.stamps.append(moment)
                self._save(name, bucket)

    def purge(self, now: float | None = None) -> int:
        """Удаляет ключи старше суток. Возвращает число удалённых файлов."""
        moment = _now() if now is None else now
        removed = 0
        with self._lock:
            for path in self._dir.glob("*.json"):
                try:
                    stamps = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    stamps = []
                if not stamps or moment - max(stamps) >= config.RATE_TTL_SECONDS:
                    path.unlink(missing_ok=True)
                    removed += 1
        return removed
