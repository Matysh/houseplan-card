"""HTTP-слой relay: ровно два маршрута и ни одного лишнего.

`POST /v1/reports` — приём отчёта, `GET /health` — состояние. Всё остальное
отвечает 404 без подсказок. Журнал пишет метод, путь, статус и код отказа; ни
адреса источника, ни сообщения, ни вложения в журнале нет и быть не должно —
это требование §9.2/§9.3 ТЗ, а не предпочтение.
"""

from __future__ import annotations

import json
import logging
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import config as config_module
from . import delivery as delivery_module
from . import multipart, ratelimit, store, validate

LOG = logging.getLogger("hp-support-relay")

ALLOWED_PARTS = frozenset({"request", "attachment"})

STATUS_BY_CODE = {
    "support_invalid_message": HTTPStatus.BAD_REQUEST,
    "support_rejected": HTTPStatus.BAD_REQUEST,
    "support_package_too_large": HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
    "support_rate_limited": HTTPStatus.TOO_MANY_REQUESTS,
    "support_unavailable": HTTPStatus.SERVICE_UNAVAILABLE,
}


class Service:
    """Логика, отделённая от транспорта: её же вызывают тесты."""

    def __init__(self, cfg) -> None:
        self.cfg = cfg
        self.store = store.Store(cfg.spool)
        self.limiter = ratelimit.Limiter(cfg.spool)
        self.secret = ratelimit.node_secret(cfg.spool)
        self.delivery = delivery_module.build(cfg)

    def health(self) -> dict:
        return {
            "status": "ok" if self.cfg.enabled else "disabled",
            "mode": self.cfg.mode,
            "delivers": self.cfg.delivers,
            "retention_days": self.cfg.retention_days,
        }

    def handle_report(self, content_type: str, body: bytes, source: str) -> tuple[int, dict]:
        if not self.cfg.enabled:
            # Рубильник обязан отказывать единообразно и retryable, а не
            # принимать отчёт и тихо его ронять (§19 ТЗ).
            return self._error("support_unavailable")

        try:
            boundary = multipart.parse_content_type(content_type)
            parts = multipart.parse(body, boundary, ALLOWED_PARTS)
        except multipart.MultipartError as error:
            LOG.info("reject multipart: %s", error)
            return self._error("support_rejected")

        if "request" not in parts:
            return self._error("support_rejected")
        if parts["request"].content_type not in {"application/json", ""}:
            return self._error("support_rejected")

        try:
            request = validate.parse_request(parts["request"].body)
            attachment = parts.get("attachment")
            if attachment is not None:
                validate.check_attachment(
                    attachment.body, attachment.filename, attachment.content_type, request,
                )
            elif request.attachment_size:
                return self._error("support_rejected")
        except validate.ValidationError as error:
            LOG.info("reject payload: %s (%s)", error, error.code)
            return self._error(error.code)

        existing = self.store.lookup(request.idempotency_key)
        if existing:
            # Повтор возвращает исходный идентификатор и НЕ тратит лимит:
            # это та же попытка, а не новая.
            LOG.info("idempotent replay -> %s", existing)
            return HTTPStatus.OK, {"report_id": existing, "duplicate": True}

        key = ratelimit.source_key(self.secret, source)
        try:
            self.limiter.check_and_count(key)
        except ratelimit.RateLimited as error:
            LOG.info("rate limited: %s", "global" if str(error) == "_global" else "source")
            return self._error("support_rate_limited")

        report_id = store.new_report_id()
        meta = {
            "report_id": report_id,
            "received_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "message": request.message,
            "contact": request.contact,
            "versions": request.versions,
            "attachment_size": len(attachment.body) if attachment else 0,
            "attachment_sha256": request.attachment_sha256,
        }
        stored = self.store.save(report_id, meta, attachment.body if attachment else None)
        result = self.delivery.send(report_id, meta, attachment.body if attachment else None)
        self.store.mark_delivery(stored, "sent" if result.ok else "failed", result.detail)
        if not result.ok:
            LOG.warning("delivery failed for %s: %s", report_id, result.detail)
            # Отчёт на диске, но пользователю обещать доставку нельзя.
            return self._error("support_unavailable")
        self.store.remember(request.idempotency_key, report_id)
        LOG.info("accepted %s (%s)", report_id, result.detail)
        return HTTPStatus.OK, {"report_id": report_id}

    @staticmethod
    def _error(code: str) -> tuple[int, dict]:
        return STATUS_BY_CODE.get(code, HTTPStatus.BAD_REQUEST), {"error": code}


def make_handler(service: Service):
    class Handler(BaseHTTPRequestHandler):
        server_version = "hp-support-relay"
        sys_version = ""
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args) -> None:  # noqa: A003 - базовый класс
            # Штатный логгер BaseHTTPRequestHandler печатает адрес клиента.
            # Здесь он заменён на строку без адреса: сырой IP не должен попадать
            # в журналы приложения (§9.2 ТЗ).
            LOG.info("%s %s", self.command, self.path)

        def _respond(self, status: int, payload: dict) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(int(status))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _source(self) -> str:
            if service.cfg.trusted_proxy:
                forwarded = self.headers.get("X-Forwarded-For", "")
                if forwarded:
                    return forwarded.split(",")[0].strip()
            return self.client_address[0]

        def do_GET(self) -> None:  # noqa: N802 - имя задано базовым классом
            if self.path == "/health":
                self._respond(HTTPStatus.OK, service.health())
                return
            self._respond(HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/v1/reports":
                self._respond(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                return
            raw_length = self.headers.get("Content-Length")
            if raw_length is None or not raw_length.isdigit():
                # Без объявленной длины нельзя отказать ДО буферизации,
                # а буферизовать неизвестно сколько — и есть та самая дыра.
                self._respond(HTTPStatus.LENGTH_REQUIRED, {"error": "support_rejected"})
                return
            length = int(raw_length)
            if length > config_module.MAX_REQUEST_BYTES:
                self._respond(
                    HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "support_package_too_large"},
                )
                return
            body = self.rfile.read(length)
            status, payload = service.handle_report(
                self.headers.get("Content-Type", ""), body, self._source(),
            )
            self._respond(status, payload)

    return Handler


def serve(cfg) -> None:
    service = Service(cfg)
    server = ThreadingHTTPServer(("127.0.0.1", cfg.port), make_handler(service))
    LOG.info(
        "listening on 127.0.0.1:%s mode=%s delivers=%s", cfg.port, cfg.mode, cfg.delivers,
    )
    server.serve_forever()
