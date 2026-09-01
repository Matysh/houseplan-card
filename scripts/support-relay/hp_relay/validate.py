"""Проверка содержимого запроса: схема `request`, вложение, тексты.

Три правила, которые здесь удерживаются:

1. Схема закрытая. Неизвестное поле — отказ, а не игнорирование.
2. Тексты остаются текстами. Ни message, ни contact никогда не попадают в
   разметку: доставка выводит их как plain text, а управляющие символы
   вычищаются здесь, чтобы получатель не увидел «пустое» письмо с сюрпризом.
3. Вложение — ровно тот файл, о котором объявил отправитель: длина и sha256
   сверяются с заявленными, содержимое разбирается и проверяется по allowlist
   верхнего уровня (§7.1 ТЗ).
"""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass

from . import config

SCHEMA_VERSION = 1

REQUEST_REQUIRED = frozenset({"schema_version", "message", "idempotency_key"})
REQUEST_OPTIONAL = frozenset({"contact", "versions", "attachment"})
REQUEST_ALLOWED = REQUEST_REQUIRED | REQUEST_OPTIONAL

VERSIONS_ALLOWED = frozenset({"card", "integration", "home_assistant", "model", "export_schema"})
ATTACHMENT_META_ALLOWED = frozenset({"size", "sha256"})

PACKAGE_ALLOWED_TOP_LEVEL = frozenset({
    "format", "version", "versions", "runtime", "revisions",
    "summary", "validation", "repairs", "plan_backup",
})
PACKAGE_FORMAT = "houseplan-support-package"
PACKAGE_VERSION = 1

IDEMPOTENCY_RE = re.compile(r"\A[A-Za-z0-9_.:-]{8,128}\Z")
SHA256_RE = re.compile(r"\A[0-9a-f]{64}\Z")
SAFE_VERSION_RE = re.compile(r"\A[0-9A-Za-z._+-]{1,32}\Z")
FILENAME_RE = re.compile(r"\Ahouseplan-support-[0-9a-z-]{1,40}\.json\Z")


class ValidationError(ValueError):
    """Публичная причина отказа. Текст безопасно показывать наружу."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def plain_text(value: str, limit: int, field: str) -> str:
    """Возвращает текст без управляющих символов и без сюрпризов раскладки.

    Удаляются категории Cc (кроме перевода строки и табуляции) и Cf — в неё
    входят маркеры двунаправленного письма, которыми в письме можно перевернуть
    видимый порядок строк, не меняя байтов.
    """
    if not isinstance(value, str):
        raise ValidationError("support_rejected", f"{field} must be a string")
    normalized = unicodedata.normalize("NFC", value)
    cleaned = "".join(
        ch for ch in normalized
        if ch in "\n\t" or unicodedata.category(ch) not in {"Cc", "Cf"}
    )
    cleaned = cleaned.replace("\r\n", "\n").strip()
    if len(cleaned) > limit:
        raise ValidationError("support_rejected", f"{field} is too long")
    return cleaned


@dataclass(frozen=True)
class Request:
    message: str
    contact: str
    versions: dict[str, str]
    idempotency_key: str
    attachment_size: int
    attachment_sha256: str


def parse_request(raw: bytes) -> Request:
    if len(raw) > 128 * 1024:
        raise ValidationError("support_rejected", "request part is too large")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError("support_rejected", "request part is not valid JSON") from exc
    if not isinstance(payload, dict):
        raise ValidationError("support_rejected", "request part must be an object")

    unknown = set(payload) - REQUEST_ALLOWED
    if unknown:
        raise ValidationError("support_rejected", f"unknown request fields: {sorted(unknown)}")
    missing = REQUEST_REQUIRED - set(payload)
    if missing:
        raise ValidationError("support_rejected", f"missing request fields: {sorted(missing)}")
    if payload["schema_version"] != SCHEMA_VERSION:
        raise ValidationError("support_rejected", "unsupported schema_version")

    message = plain_text(payload["message"], config.MAX_MESSAGE_CODEPOINTS, "message")
    if not message:
        raise ValidationError("support_invalid_message", "message is empty")
    contact = plain_text(payload.get("contact", ""), config.MAX_CONTACT_CODEPOINTS, "contact")

    key = payload["idempotency_key"]
    if not isinstance(key, str) or not IDEMPOTENCY_RE.match(key):
        raise ValidationError("support_rejected", "bad idempotency_key")

    versions_raw = payload.get("versions", {})
    if not isinstance(versions_raw, dict):
        raise ValidationError("support_rejected", "versions must be an object")
    unknown_versions = set(versions_raw) - VERSIONS_ALLOWED
    if unknown_versions:
        raise ValidationError("support_rejected", f"unknown versions: {sorted(unknown_versions)}")
    versions: dict[str, str] = {}
    for name, value in versions_raw.items():
        text = str(value)
        if not SAFE_VERSION_RE.match(text):
            raise ValidationError("support_rejected", f"bad version value: {name}")
        versions[name] = text

    meta = payload.get("attachment", {})
    if not isinstance(meta, dict):
        raise ValidationError("support_rejected", "attachment meta must be an object")
    unknown_meta = set(meta) - ATTACHMENT_META_ALLOWED
    if unknown_meta:
        raise ValidationError("support_rejected", f"unknown attachment meta: {sorted(unknown_meta)}")
    size = meta.get("size", 0)
    digest = meta.get("sha256", "")
    if not isinstance(size, int) or isinstance(size, bool) or size < 0:
        raise ValidationError("support_rejected", "attachment size must be a non-negative integer")
    if size > config.MAX_ATTACHMENT_BYTES:
        raise ValidationError("support_package_too_large", "attachment is too large")
    if digest and not (isinstance(digest, str) and SHA256_RE.match(digest)):
        raise ValidationError("support_rejected", "attachment sha256 must be lowercase hex")

    return Request(
        message=message,
        contact=contact,
        versions=versions,
        idempotency_key=key,
        attachment_size=size,
        attachment_sha256=digest,
    )


def check_attachment(body: bytes, filename: str | None, content_type: str, request: Request) -> None:
    if content_type != "application/json":
        raise ValidationError("support_rejected", "attachment must be application/json")
    if not filename or not FILENAME_RE.match(filename):
        raise ValidationError("support_rejected", "unexpected attachment filename")
    if len(body) > config.MAX_ATTACHMENT_BYTES:
        raise ValidationError("support_package_too_large", "attachment is too large")
    if request.attachment_size and len(body) != request.attachment_size:
        raise ValidationError("support_rejected", "attachment size does not match the declared one")
    if request.attachment_sha256:
        actual = hashlib.sha256(body).hexdigest()
        if actual != request.attachment_sha256:
            raise ValidationError("support_rejected", "attachment hash does not match the declared one")
    try:
        package = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValidationError("support_rejected", "attachment is not valid JSON") from exc
    if not isinstance(package, dict):
        raise ValidationError("support_rejected", "attachment must be an object")
    if package.get("format") != PACKAGE_FORMAT:
        raise ValidationError("support_rejected", "attachment format is not recognised")
    if package.get("version") != PACKAGE_VERSION:
        raise ValidationError("support_rejected", "unsupported attachment version")
    unknown = set(package) - PACKAGE_ALLOWED_TOP_LEVEL
    if unknown:
        raise ValidationError("support_rejected", f"unknown package sections: {sorted(unknown)}")
