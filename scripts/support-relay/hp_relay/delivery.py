"""Доставка отчёта мейнтейнеру.

Канал доставки — Telegram (решение владельца 2026-09-01): сообщение с
идентификатором и безопасными версиями плюс сам пакет отдельным документом.
Разметка НЕ используется намеренно: без `parse_mode` Telegram показывает текст
буквально, поэтому сообщение пользователя не может ничего разметить, подделать
или скрыть.

Ответ провайдера наружу не отражается ни при каких условиях (§9.2 ТЗ): наверх
уходит только «удалось / не удалось», а подробность живёт в журнале узла.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

TIMEOUT_SECONDS = 20
API = "https://api.telegram.org"


@dataclass(frozen=True)
class Result:
    ok: bool
    detail: str


def _post(url: str, body: bytes, content_type: str) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, response.read(4096)
    except urllib.error.HTTPError as error:
        return error.code, error.read(4096)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return 0, str(error).encode("utf-8", "replace")[:4096]


def _multipart(fields: dict[str, str], filename: str, blob: bytes) -> tuple[bytes, str]:
    boundary = "hp" + os.urandom(16).hex()
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'
            .encode("utf-8")
        )
    chunks.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="document"; filename="{filename}"\r\n'
        f"Content-Type: application/json\r\n\r\n".encode("utf-8")
    )
    chunks.append(blob)
    chunks.append(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def summary_text(report_id: str, meta: dict) -> str:
    versions = meta.get("versions") or {}
    lines = [
        f"House Plan support report {report_id}",
        "",
        "versions: " + (", ".join(f"{k}={v}" for k, v in sorted(versions.items())) or "—"),
        "attachment: " + (f"{meta.get('attachment_size', 0)} B" if meta.get("attachment_size") else "—"),
        "contact: " + (meta.get("contact") or "—"),
        "",
        "message:",
        meta.get("message", ""),
    ]
    text = "\n".join(lines)
    # Ограничение Telegram на сообщение — 4096 символов; сообщение пользователя
    # может быть длиннее, поэтому хвост отрезается с явной пометкой, а полный
    # текст остаётся в отчёте на диске.
    if len(text) > 3900:
        text = text[:3900] + "\n[…] полный текст — в report.json на узле"
    return text


class TelegramDelivery:
    def __init__(self, token: str, chat_id: str) -> None:
        self._token = token
        self._chat_id = chat_id

    def send(self, report_id: str, meta: dict, attachment: bytes | None) -> Result:
        body = json.dumps({
            "chat_id": self._chat_id,
            "text": summary_text(report_id, meta),
            "disable_web_page_preview": True,
        }).encode("utf-8")
        status, _ = _post(f"{API}/bot{self._token}/sendMessage", body, "application/json")
        if status != 200:
            return Result(False, f"sendMessage status {status}")
        if attachment is None:
            return Result(True, "message only")
        payload, content_type = _multipart(
            {"chat_id": self._chat_id, "caption": report_id},
            f"houseplan-support-{report_id}.json",
            attachment,
        )
        status, _ = _post(f"{API}/bot{self._token}/sendDocument", payload, content_type)
        if status != 200:
            return Result(False, f"sendDocument status {status}")
        return Result(True, "message and document")


class DiscardDelivery:
    """Staging: отчёт принимается и складывается, но никуда не уходит."""

    def send(self, report_id: str, meta: dict, attachment: bytes | None) -> Result:
        return Result(True, "discarded (staging)")


def build(cfg) -> object:
    if cfg.delivers:
        return TelegramDelivery(cfg.telegram_token, cfg.telegram_chat_id)
    return DiscardDelivery()
