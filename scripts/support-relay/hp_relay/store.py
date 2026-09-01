"""Спул отчётов и записи идемпотентности.

Отчёт кладётся на диск ДО попытки доставки: доставка может не удаться, а
обращение пользователя терять нельзя — оно и есть предмет задачи. Ретеншн
описан в README и исполняется отдельным таймером, а не этим процессом.
"""

from __future__ import annotations

import json
import os
import shutil
import threading
import time
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from . import config


def new_report_id() -> str:
    """Короткий непрозрачный идентификатор: показывается пользователю целиком."""
    return "hpr-" + os.urandom(5).hex()


@dataclass(frozen=True)
class StoredReport:
    report_id: str
    directory: Path


class Store:
    def __init__(self, spool: Path) -> None:
        self.spool = spool
        self.reports = spool / "reports"
        self.idem = spool / "idem"
        for path in (self.reports, self.idem):
            path.mkdir(parents=True, exist_ok=True)
        spool.chmod(0o700)
        self._lock = threading.Lock()

    # --- идемпотентность -------------------------------------------------
    def _idem_path(self, key: str) -> Path:
        return self.idem / (sha256(key.encode("utf-8")).hexdigest()[:32] + ".json")

    def lookup(self, key: str, now: float | None = None) -> str | None:
        moment = time.time() if now is None else now
        path = self._idem_path(key)
        if not path.exists():
            return None
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return None
        if moment - float(record.get("created", 0)) >= config.IDEMPOTENCY_TTL_SECONDS:
            path.unlink(missing_ok=True)
            return None
        value = record.get("report_id")
        return value if isinstance(value, str) else None

    def remember(self, key: str, report_id: str, now: float | None = None) -> None:
        moment = time.time() if now is None else now
        path = self._idem_path(key)
        tmp = path.with_suffix(".tmp")
        # Запись содержит только идентификатор и время: ни сообщения, ни адреса.
        tmp.write_text(json.dumps({"report_id": report_id, "created": moment}), encoding="utf-8")
        tmp.chmod(0o600)
        tmp.replace(path)

    # --- отчёты ----------------------------------------------------------
    def save(self, report_id: str, meta: dict, attachment: bytes | None) -> StoredReport:
        directory = self.reports / time.strftime("%Y-%m", time.gmtime()) / report_id
        directory.mkdir(parents=True, exist_ok=True)
        directory.chmod(0o700)
        meta_path = directory / "report.json"
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        meta_path.chmod(0o600)
        if attachment is not None:
            blob = directory / f"houseplan-support-{report_id}.json"
            blob.write_bytes(attachment)
            blob.chmod(0o600)
        return StoredReport(report_id=report_id, directory=directory)

    def mark_delivery(self, stored: StoredReport, status: str, detail: str = "") -> None:
        path = stored.directory / "delivery.json"
        path.write_text(
            json.dumps({"status": status, "detail": detail, "at": time.time()}, ensure_ascii=False),
            encoding="utf-8",
        )
        path.chmod(0o600)

    # --- ретеншн ---------------------------------------------------------
    def purge(self, retention_days: int, now: float | None = None) -> int:
        """Удаляет отчёты старше срока хранения. Возвращает число удалённых."""
        moment = time.time() if now is None else now
        deadline = moment - retention_days * 86400
        removed = 0
        with self._lock:
            for directory in sorted(self.reports.glob("*/*")):
                if not directory.is_dir():
                    continue
                if directory.stat().st_mtime < deadline:
                    shutil.rmtree(directory, ignore_errors=True)
                    removed += 1
            for path in self.idem.glob("*.json"):
                try:
                    record = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    record = {}
                if moment - float(record.get("created", 0)) >= config.IDEMPOTENCY_TTL_SECONDS:
                    path.unlink(missing_ok=True)
                    removed += 1
        return removed
