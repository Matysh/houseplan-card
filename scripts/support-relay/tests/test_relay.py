"""Тесты приёмщика (§14.3 ТЗ 043). Запуск: python3 -m unittest discover -s tests

Проверки написаны так, чтобы каждая умела падать: рядом с положительным
утверждением стоит отрицательное — «а вот на таком входе обязан быть отказ».
"""

from __future__ import annotations

import io
import json
import logging
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from hashlib import sha256
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from hp_relay import app, config, delivery, ratelimit, store, validate  # noqa: E402

PACKAGE = {
    "format": "houseplan-support-package",
    "version": 1,
    "versions": {"card": "1.70.0", "integration": "1.70.0", "home_assistant": "2026.8.0",
                 "model": 9, "export_schema": 1},
    "runtime": {"browser_family": "chromium"},
    "revisions": {"config": 17, "layout": 24},
    "summary": {}, "validation": {}, "repairs": [],
    "plan_backup": {"config": {}, "layout": {}},
}


def package_bytes(extra: dict | None = None) -> bytes:
    payload = dict(PACKAGE)
    if extra:
        payload.update(extra)
    return (json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")


def build_body(request: dict, attachment: bytes | None, *, filename: str | None = None,
               attachment_type: str = "application/json",
               extra_part: tuple[str, bytes] | None = None) -> tuple[str, bytes]:
    boundary = "----hp-test-boundary"
    chunks = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="request"\r\n'
        f"Content-Type: application/json\r\n\r\n".encode("utf-8"),
        json.dumps(request, ensure_ascii=False).encode("utf-8"),
        b"\r\n",
    ]
    if attachment is not None:
        name = filename or "houseplan-support-test.json"
        chunks += [
            f'--{boundary}\r\nContent-Disposition: form-data; name="attachment"; filename="{name}"\r\n'
            f"Content-Type: {attachment_type}\r\n\r\n".encode("utf-8"),
            attachment,
            b"\r\n",
        ]
    if extra_part is not None:
        part_name, part_body = extra_part
        chunks += [
            f'--{boundary}\r\nContent-Disposition: form-data; name="{part_name}"\r\n\r\n'
            .encode("utf-8"),
            part_body,
            b"\r\n",
        ]
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return f"multipart/form-data; boundary={boundary}", b"".join(chunks)


def request_json(blob: bytes | None, *, key: str = "idem-key-0001", message: str = "не работает",
                 contact: str = "", **overrides) -> dict:
    payload = {
        "schema_version": 1,
        "message": message,
        "idempotency_key": key,
        "versions": {"card": "1.70.0"},
    }
    if contact:
        payload["contact"] = contact
    if blob is not None:
        payload["attachment"] = {"size": len(blob), "sha256": sha256(blob).hexdigest()}
    payload.update(overrides)
    return payload


class RecordingDelivery:
    """Поддельный провайдер: запоминает ровно то, что ему передали."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict, bytes | None]] = []
        self.ok = True

    def send(self, report_id, meta, attachment):
        self.calls.append((report_id, meta, attachment))
        return delivery.Result(self.ok, "recorded")


class captured_log:
    """Собирает всё, что уходит в журнал relay, — включая транспортный слой."""

    def __enter__(self):
        self._stream = io.StringIO()
        self._handler = logging.StreamHandler(self._stream)
        self._logger = logging.getLogger("hp-support-relay")
        self._logger.addHandler(self._handler)
        self._previous = self._logger.level
        self._logger.setLevel(logging.INFO)
        return self._stream

    def __exit__(self, *exc):
        self._logger.removeHandler(self._handler)
        self._logger.setLevel(self._previous)
        return False


class RelayTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        self.spool = Path(self._tmp.name) / "spool"
        self.cfg = config.load({"HP_RELAY_SPOOL": str(self.spool), "HP_RELAY_MODE": "discard"})
        self.service = app.Service(self.cfg)
        self.provider = RecordingDelivery()
        self.service.delivery = self.provider

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def post(self, request: dict, attachment: bytes | None, source: str = "203.0.113.1", **kwargs):
        content_type, body = build_body(request, attachment, **kwargs)
        return self.service.handle_report(content_type, body, source)

    # --- приём ---------------------------------------------------------
    def test_accepts_a_well_formed_report(self):
        blob = package_bytes()
        status, payload = self.post(request_json(blob), blob)
        self.assertEqual(status, 200, payload)
        self.assertTrue(payload["report_id"].startswith("hpr-"))
        self.assertEqual(len(self.provider.calls), 1)

    def test_delivered_attachment_is_byte_identical(self):
        blob = package_bytes({"revisions": {"config": 3, "layout": 4}})
        self.post(request_json(blob), blob)
        _, _, delivered = self.provider.calls[0]
        self.assertEqual(delivered, blob)

    def test_report_and_attachment_land_in_the_spool(self):
        blob = package_bytes()
        _, payload = self.post(request_json(blob), blob)
        found = list(self.spool.glob(f"reports/*/{payload['report_id']}/*.json"))
        names = sorted(path.name for path in found)
        self.assertIn("report.json", names)
        self.assertIn(f"houseplan-support-{payload['report_id']}.json", names)

    # --- отказы --------------------------------------------------------
    def test_unknown_part_is_rejected(self):
        blob = package_bytes()
        status, payload = self.post(request_json(blob), blob, extra_part=("evil", b"x"))
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_unknown_request_field_is_rejected(self):
        status, payload = self.post(request_json(None, tracking_pixel="yes"), None)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_wrong_hash_is_rejected(self):
        blob = package_bytes()
        request = request_json(blob)
        request["attachment"]["sha256"] = "0" * 64
        status, payload = self.post(request, blob)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_wrong_size_is_rejected(self):
        blob = package_bytes()
        request = request_json(blob)
        request["attachment"]["size"] = len(blob) + 1
        status, payload = self.post(request, blob)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_foreign_package_format_is_rejected(self):
        blob = (json.dumps({"format": "something-else", "version": 1}) + "\n").encode("utf-8")
        status, payload = self.post(request_json(blob), blob)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_unknown_package_section_is_rejected(self):
        blob = package_bytes({"exfiltrated": {"token": "secret"}})
        status, payload = self.post(request_json(blob), blob)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_oversized_attachment_is_rejected(self):
        blob = package_bytes({"summary": {"pad": "x" * (config.MAX_ATTACHMENT_BYTES + 16)}})
        status, payload = self.post(request_json(blob), blob)
        self.assertEqual((status, payload["error"]), (413, "support_package_too_large"))

    def test_empty_message_is_rejected(self):
        status, payload = self.post(request_json(None, message="   "), None)
        self.assertEqual((status, payload["error"]), (400, "support_invalid_message"))

    def test_declared_attachment_without_body_is_rejected(self):
        blob = package_bytes()
        status, payload = self.post(request_json(blob), None)
        self.assertEqual((status, payload["error"]), (400, "support_rejected"))

    def test_disabled_relay_refuses_uniformly(self):
        cfg = config.load({"HP_RELAY_SPOOL": str(self.spool), "HP_RELAY_ENABLED": "0"})
        service = app.Service(cfg)
        service.delivery = RecordingDelivery()
        content_type, body = build_body(request_json(None), None)
        status, payload = service.handle_report(content_type, body, "203.0.113.1")
        self.assertEqual((status, payload["error"]), (503, "support_unavailable"))
        self.assertEqual(service.delivery.calls, [])

    def test_failed_delivery_does_not_promise_success(self):
        self.provider.ok = False
        blob = package_bytes()
        status, payload = self.post(request_json(blob), blob)
        self.assertEqual((status, payload["error"]), (503, "support_unavailable"))
        # Обращение всё равно сохранено — терять его нельзя.
        self.assertTrue(list(self.spool.glob("reports/*/*/report.json")))

    # --- тексты --------------------------------------------------------
    def test_markup_and_controls_stay_literal_text(self):
        nasty = "<b>bold</b>\r\nSubject: injected‮gnitpircs"
        blob = package_bytes()
        self.post(request_json(blob, message=nasty), blob)
        _, meta, _ = self.provider.calls[0]
        self.assertIn("<b>bold</b>", meta["message"])          # разметка не исполняется, а видна
        self.assertNotIn("‮", meta["message"])            # bidi-переворот вычищен
        self.assertNotIn("", meta["message"])            # управляющий символ вычищен
        self.assertNotIn("\r", meta["message"])                # склейка заголовков невозможна

    def test_summary_text_carries_no_markup_mode(self):
        text = delivery.summary_text("hpr-1", {"message": "<i>x</i>", "versions": {"card": "1.70.0"}})
        self.assertIn("<i>x</i>", text)

    # --- лимиты и идемпотентность ---------------------------------------
    def test_hourly_limit_stops_the_sixth_attempt(self):
        blob = package_bytes()
        for index in range(config.RATE_HOURLY):
            status, _ = self.post(request_json(blob, key=f"idem-key-{index:04d}"), blob)
            self.assertEqual(status, 200)
        status, payload = self.post(request_json(blob, key="idem-key-9999"), blob)
        self.assertEqual((status, payload["error"]), (429, "support_rate_limited"))

    def test_other_source_is_not_limited_by_the_first(self):
        blob = package_bytes()
        for index in range(config.RATE_HOURLY):
            self.post(request_json(blob, key=f"idem-key-{index:04d}"), blob)
        status, _ = self.post(request_json(blob, key="idem-key-8888"), blob, source="198.51.100.7")
        self.assertEqual(status, 200)

    def test_replay_returns_the_original_id_without_spending_the_limit(self):
        blob = package_bytes()
        _, first = self.post(request_json(blob), blob)
        _, second = self.post(request_json(blob), blob)
        self.assertEqual(second["report_id"], first["report_id"])
        self.assertTrue(second["duplicate"])
        self.assertEqual(len(self.provider.calls), 1)          # второй раз не доставляли
        for index in range(config.RATE_HOURLY - 1):
            status, _ = self.post(request_json(blob, key=f"idem-key-{index:04d}"), blob)
            self.assertEqual(status, 200)                      # повтор лимит не потратил

    def test_source_key_hides_the_address_and_rotates_daily(self):
        secret = ratelimit.node_secret(self.spool)
        address = "203.0.113.42"
        today = ratelimit.source_key(secret, address)
        tomorrow = ratelimit.source_key(secret, address, now=time.time() + 86400)
        self.assertNotIn(address, today)
        self.assertNotEqual(today, tomorrow)

    # --- журналы --------------------------------------------------------
    def test_logs_do_not_carry_the_message(self):
        with captured_log() as stream:
            blob = package_bytes()
            self.post(request_json(blob, message="секретная жалоба"), blob, source="203.0.113.77")
        self.assertNotIn("секретная жалоба", stream.getvalue())

    # --- ретеншн --------------------------------------------------------
    def test_purge_deletes_old_reports_and_keeps_fresh_ones(self):
        blob = package_bytes()
        _, fresh = self.post(request_json(blob), blob)
        _, stale = self.post(request_json(blob, key="idem-key-0002"), blob)
        stale_dir = next(self.spool.glob(f"reports/*/{stale['report_id']}"))
        old = time.time() - 31 * 86400
        import os
        os.utime(stale_dir, (old, old))
        removed = self.service.store.purge(self.cfg.retention_days)
        self.assertGreaterEqual(removed, 1)
        self.assertFalse(stale_dir.exists())
        self.assertTrue(next(self.spool.glob(f"reports/*/{fresh['report_id']}")).exists())

    def test_idempotency_record_expires_after_a_day(self):
        self.service.store.remember("idem-key-old1", "hpr-old", now=time.time() - 25 * 3600)
        self.assertIsNone(self.service.store.lookup("idem-key-old1"))

    def test_rate_keys_expire_after_a_day(self):
        limiter = ratelimit.Limiter(self.spool)
        key = ratelimit.source_key(self.service.secret, "203.0.113.9")
        limiter.check_and_count(key, now=time.time() - 25 * 3600)
        self.assertEqual(limiter.purge(), 2)                   # ключ источника и глобальный

    def test_retention_defaults_match_the_disclosed_policy(self):
        self.assertEqual(self.cfg.retention_days, 30)
        self.assertEqual(config.IDEMPOTENCY_TTL_SECONDS, 24 * 3600)
        self.assertEqual(config.RATE_TTL_SECONDS, 24 * 3600)


class HttpSurfaceTestCase(unittest.TestCase):
    """Проверки, которые живут только на транспортном уровне."""

    def setUp(self) -> None:
        self._tmp = TemporaryDirectory()
        cfg = config.load({"HP_RELAY_SPOOL": str(Path(self._tmp.name) / "s"), "HP_RELAY_PORT": "0"})
        self.service = app.Service(cfg)
        self.service.delivery = RecordingDelivery()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), app.make_handler(self.service))
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self._tmp.cleanup()

    def call(self, method: str, path: str, body: bytes | None = None,
             content_type: str = "application/octet-stream", headers: dict | None = None):
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}", data=body, method=method,
        )
        if body is not None:
            request.add_header("Content-Type", content_type)
        for name, value in (headers or {}).items():
            request.add_header(name, value)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_health_reports_mode_without_secrets(self):
        status, payload = self.call("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "ok")
        self.assertNotIn("telegram_token", json.dumps(payload))

    def test_unknown_route_is_not_described(self):
        status, payload = self.call("GET", "/admin")
        self.assertEqual((status, payload["error"]), (404, "not_found"))

    def test_oversized_request_is_refused_before_reading(self):
        content_type, body = build_body(request_json(None), None)
        status, payload = self.call(
            "POST", "/v1/reports", body, content_type,
            headers={"Content-Length": str(config.MAX_REQUEST_BYTES + 1)},
        )
        self.assertEqual((status, payload["error"]), (413, "support_package_too_large"))

    def test_transport_log_carries_no_client_address(self):
        """Адрес пишет штатный логгер BaseHTTPRequestHandler — проверяем ЕГО.

        Сервис-уровневый тест сюда не достаёт: `log_message` вызывается из
        `send_response`, то есть только при настоящем HTTP-запросе.
        """
        blob = package_bytes()
        content_type, body = build_body(request_json(blob), blob)
        with captured_log() as stream:
            status, _ = self.call("POST", "/v1/reports", body, content_type,
                                  headers={"X-Forwarded-For": "198.51.100.5"})
        self.assertEqual(status, 200)
        written = stream.getvalue()
        self.assertIn("POST /v1/reports", written)      # журнал не пуст — проверка настоящая
        self.assertNotIn("127.0.0.1", written)          # адрес соединения
        self.assertNotIn("198.51.100.5", written)       # адрес из заголовка

    def test_forwarded_for_is_used_as_the_source(self):
        blob = package_bytes()
        content_type, body = build_body(request_json(blob), blob)
        status, _ = self.call("POST", "/v1/reports", body, content_type,
                              headers={"X-Forwarded-For": "198.51.100.5"})
        self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main()
