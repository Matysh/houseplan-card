"""Строгий разбор multipart/form-data.

Строгий — значит «принимаем ровно то, что описано в §8.3 ТЗ, всё остальное
отвергаем». Публичный эндпоинт без общего секрета защищается схемой, размером и
частотой; парсер здесь — первая из трёх защит, поэтому он не прощает ничего:
ни лишних частей, ни повторов, ни отсутствующей границы, ни вложенного
multipart.
"""

from __future__ import annotations

from dataclasses import dataclass


class MultipartError(ValueError):
    """Тело не соответствует объявленной схеме."""


@dataclass(frozen=True)
class Part:
    name: str
    filename: str | None
    content_type: str
    body: bytes


def parse_content_type(header: str) -> str:
    """Возвращает boundary или бросает MultipartError."""
    if not header:
        raise MultipartError("missing content-type")
    pieces = [piece.strip() for piece in header.split(";")]
    if pieces[0].lower() != "multipart/form-data":
        raise MultipartError("content-type must be multipart/form-data")
    for piece in pieces[1:]:
        key, _, value = piece.partition("=")
        if key.strip().lower() != "boundary":
            continue
        value = value.strip()
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            value = value[1:-1]
        if not value or len(value) > 70:
            raise MultipartError("bad boundary")
        return value
    raise MultipartError("missing boundary")


def _split_headers(chunk: bytes) -> tuple[dict[str, str], bytes]:
    head, sep, body = chunk.partition(b"\r\n\r\n")
    if not sep:
        raise MultipartError("part without headers")
    headers: dict[str, str] = {}
    for raw in head.split(b"\r\n"):
        if not raw:
            continue
        try:
            line = raw.decode("ascii")
        except UnicodeDecodeError as exc:
            raise MultipartError("non-ascii header") from exc
        key, _, value = line.partition(":")
        if not _:
            raise MultipartError("malformed header")
        key = key.strip().lower()
        if key in headers:
            raise MultipartError("duplicate header")
        headers[key] = value.strip()
    return headers, body


def _disposition(value: str) -> tuple[str, str | None]:
    pieces = [piece.strip() for piece in value.split(";")]
    if not pieces or pieces[0].lower() != "form-data":
        raise MultipartError("bad content-disposition")
    name: str | None = None
    filename: str | None = None
    for piece in pieces[1:]:
        key, _, raw = piece.partition("=")
        raw = raw.strip()
        if raw.startswith('"') and raw.endswith('"') and len(raw) >= 2:
            raw = raw[1:-1]
        key = key.strip().lower()
        if key == "name":
            name = raw
        elif key == "filename":
            filename = raw
    if not name:
        raise MultipartError("part without name")
    return name, filename


def parse(body: bytes, boundary: str, allowed: frozenset[str]) -> dict[str, Part]:
    """Разбирает тело и возвращает части по именам.

    Имя, которого нет в `allowed`, — ошибка, а не игнорируемое поле: клиент,
    приславший лишнюю часть, разговаривает не по этому контракту, и молча
    принять его запрос значит принять неизвестно что.
    """
    marker = b"--" + boundary.encode("ascii")
    if not body.startswith(marker):
        raise MultipartError("body does not start with boundary")
    rest = body[len(marker):]
    if rest.startswith(b"--"):
        raise MultipartError("empty body")
    if not rest.startswith(b"\r\n"):
        raise MultipartError("malformed preamble")
    # Открывающая граница снимается ДО разбиения: иначе первая часть вбирает
    # в себя весь остаток тела вместе с чужими заголовками.
    segments = rest[2:].split(b"\r\n" + marker)
    parts: dict[str, Part] = {}
    closed = False
    for index, segment in enumerate(segments):
        if index:
            if segment.startswith(b"--"):
                closed = True
                break
            if not segment.startswith(b"\r\n"):
                raise MultipartError("malformed boundary")
            segment = segment[2:]
        headers, raw = _split_headers(segment)
        name, filename = _disposition(headers.get("content-disposition", ""))
        if name not in allowed:
            raise MultipartError(f"unexpected part: {name}")
        if name in parts:
            raise MultipartError(f"duplicate part: {name}")
        content_type = headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type.startswith("multipart/"):
            raise MultipartError("nested multipart is not accepted")
        parts[name] = Part(name=name, filename=filename, content_type=content_type, body=raw)
    if not closed:
        raise MultipartError("missing closing boundary")
    return parts
