"""Доставка отчёта мейнтейнеру.

Каналов два, и второй появился не от любви к вариантам. Прямой Telegram
(`telegram`) — как задумывалось: сводка сообщением, пакет документом. Но узел
проекта стоит у российского хостера, откуда `api.telegram.org` недоступен по
всем адресам, — доставка молча падала с «Network is unreachable». Поэтому
основной канал стенда — `ha_webhook`: relay отдаёт сводку вебхуку Home Assistant
владельца, а последнюю милю до Telegram делает уже он, из сети, где Telegram
доступен. Пакет при этом остаётся в спуле стенда и в мессенджер не уходит —
геометрия чужого дома по чатам не гуляет.
Разметка НЕ используется намеренно: без `parse_mode` Telegram показывает текст
буквально, поэтому сообщение пользователя не может ничего разметить, подделать
или скрыть.

Ответ провайдера наружу не отражается ни при каких условиях (§9.2 ТЗ): наверх
уходит только «удалось / не удалось», а подробность живёт в журнале узла.
"""

from __future__ import annotations

import http.client
import json
import os
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass

TIMEOUT_SECONDS = 20
API = "https://api.telegram.org"


@dataclass(frozen=True)
class Result:
    ok: bool
    detail: str


def _connect_ipv4(address, timeout, source_address=None) -> socket.socket:
    """Соединение строго по IPv4.

    Узел проекта отдаёт для `api.telegram.org` и AAAA, и A, но связности по
    IPv6 у него нет: обычный `urlopen` выбирал IPv6 и молча висел до таймаута —
    доставка падала с «status 0», хотя сеть была в порядке. Явный выбор
    семейства делает поведение независимым от порядка, в котором резолвер
    вернул адреса.
    """
    host, port = address
    last: OSError | None = None
    for family, kind, proto, _canon, sockaddr in socket.getaddrinfo(
        host, port, socket.AF_INET, socket.SOCK_STREAM,
    ):
        sock = socket.socket(family, kind, proto)
        try:
            sock.settimeout(timeout)
            if source_address:
                sock.bind(source_address)
            sock.connect(sockaddr)
            return sock
        except OSError as error:
            last = error
            sock.close()
    raise last or OSError(f"no IPv4 address for {host}")


class _IPv4HTTPSConnection(http.client.HTTPSConnection):
    def connect(self) -> None:
        self.sock = _connect_ipv4((self.host, self.port), self.timeout, self.source_address)
        if self._tunnel_host:
            self._tunnel()
        self.sock = self._context.wrap_socket(
            self.sock, server_hostname=self._tunnel_host or self.host,
        )


class _IPv4HTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, req):  # noqa: D102 - контракт базового класса
        return self.do_open(_IPv4HTTPSConnection, req, context=self._context)


def _post(url: str, body: bytes, content_type: str) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", content_type)
    openers = [urllib.request.build_opener(_IPv4HTTPSHandler()), urllib.request.build_opener()]
    last_error = b""
    for opener in openers:
        try:
            with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                return response.status, response.read(4096)
        except urllib.error.HTTPError as error:
            # Ответ провайдера — это ответ, а не сбой связи: второй попытки не нужно.
            return error.code, error.read(4096)
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = str(error).encode("utf-8", "replace")[:4096]
    return 0, last_error


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
    attachment = "—"
    if meta.get("attachment_size"):
        attachment = f"{meta['attachment_size']} B"
        if meta.get("spool_path"):
            attachment += f" — {meta['spool_path']}"
    lines = [
        f"House Plan support report {report_id}",
        "",
        "versions: " + (", ".join(f"{k}={v}" for k, v in sorted(versions.items())) or "—"),
        "attachment: " + attachment,
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
        status, detail = _post(f"{API}/bot{self._token}/sendMessage", body, "application/json")
        if status != 200:
            return Result(False, f"sendMessage status {status}: {detail.decode('utf-8', 'replace')[:200]}")
        if attachment is None:
            return Result(True, "message only")
        payload, content_type = _multipart(
            {"chat_id": self._chat_id, "caption": report_id},
            f"houseplan-support-{report_id}.json",
            attachment,
        )
        status, detail = _post(f"{API}/bot{self._token}/sendDocument", payload, content_type)
        if status != 200:
            return Result(False, f"sendDocument status {status}: {detail.decode('utf-8', 'replace')[:200]}")
        return Result(True, "message and document")


class HaWebhookDelivery:
    """Последняя миля через Home Assistant владельца.

    Вебхук отдаёт только текст: адрес вебхука — сам себе ключ доступа, и чем
    меньше через него проходит, тем дешевле его ротация. Вложение остаётся на
    стенде, а сводка называет путь к нему.
    """

    def __init__(self, url: str) -> None:
        self._url = url

    def send(self, report_id: str, meta: dict, attachment: bytes | None) -> Result:
        body = json.dumps({
            "source": "houseplan-support-relay",
            "report_id": report_id,
            "text": summary_text(report_id, meta),
        }, ensure_ascii=False).encode("utf-8")
        status, detail = _post(self._url, body, "application/json")
        if status != 200:
            return Result(False, f"webhook status {status}: {detail.decode('utf-8', 'replace')[:200]}")
        return Result(True, "forwarded through Home Assistant")


class DiscardDelivery:
    """Staging: отчёт принимается и складывается, но никуда не уходит."""

    def send(self, report_id: str, meta: dict, attachment: bytes | None) -> Result:
        return Result(True, "discarded (staging)")


def build(cfg) -> object:
    if not cfg.delivers:
        return DiscardDelivery()
    if cfg.channel == "ha_webhook":
        return HaWebhookDelivery(cfg.webhook_url)
    return TelegramDelivery(cfg.telegram_token, cfg.telegram_chat_id)
