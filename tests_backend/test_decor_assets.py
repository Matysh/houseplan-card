"""#51 custom decor image security and lifecycle contracts."""
from __future__ import annotations

import base64
import hashlib
import importlib
import json
import struct
import threading
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from custom_components.houseplan.asset_integrity import (
    ASSET_INTEGRITY_CACHE_ENTRIES,
    AssetIntegrityVerifier,
)
from custom_components.houseplan.const import MAX_DECOR_ASSET_BYTES
from custom_components.houseplan.decor_assets import (
    DecorAssetError,
    asset_meta_path,
    asset_refs,
    public_asset,
    read_asset,
    read_catalog,
    validate_asset,
)

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)
JPEG_3X2 = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDx2iiiu04z/9k="
)
WEBP_VP8_3X2 = base64.b64decode(
    "UklGRjAAAABXRUJQVlA4ICQAAABQAQCdASoDAAIAAUAmJQBOgC6gAP77LkvF3YjjJ4dVU9ffoAA="
)
WEBP_VP8L_3X2 = base64.b64decode(
    "UklGRh4AAABXRUJQVlA4TBEAAAAvAkAAAAdQkTIUp/+BiOh/AAA="
)
WEBP_VP8X_3X2 = base64.b64decode(
    "UklGRlIAAABXRUJQVlA4WAoAAAAQAAAAAgAAAQAAQUxQSAcAAAAAgICAgICAAFZQOCAkAAAAUAEAnQEqAwACAAFAJiUAToAuoAD++y5Lxd2I4yeHVVPX36AA"
)


def test_png_identity_and_dimensions_are_content_addressed() -> None:
    asset = validate_asset(PNG_1X1, "pixel.PNG")
    assert (asset.mime, asset.ext, asset.width, asset.height) == ("image/png", ".png", 1, 1)
    assert len(asset.asset_id) == 64
    assert asset.asset_id == validate_asset(PNG_1X1, "other.png").asset_id


def test_declared_mime_must_agree_with_extension_and_bytes() -> None:
    with pytest.raises(DecorAssetError, match="disagree"):
        validate_asset(PNG_1X1, "pixel.png", "image/jpeg")
    assert validate_asset(PNG_1X1, "pixel.png", "image/png; charset=binary").width == 1


@pytest.mark.parametrize(("payload", "filename", "mime"), [
    (JPEG_3X2, "photo.jpeg", "image/jpeg"),
    (WEBP_VP8_3X2, "lossy.webp", "image/webp"),
    (WEBP_VP8L_3X2, "lossless.webp", "image/webp"),
    (WEBP_VP8X_3X2, "alpha.webp", "image/webp"),
])
def test_supported_raster_headers_and_dimensions(
    payload: bytes, filename: str, mime: str,
) -> None:
    """Имя до #430 обещало «and_full_decode», а проверялись w/h/mime — их даёт
    header-парсер, и мутация полного декодирования оставалась зелёной."""
    asset = validate_asset(payload, filename, "application/octet-stream")
    assert (asset.width, asset.height, asset.mime) == (3, 2, mime)


def test_upload_size_and_extension_guards() -> None:
    with pytest.raises(DecorAssetError, match="empty"):
        validate_asset(b"", "empty.png")
    with pytest.raises(DecorAssetError, match="2 MiB"):
        validate_asset(b"x" * (2 * 1024 * 1024 + 1), "large.png")
    with pytest.raises(DecorAssetError, match="PNG, JPEG, WebP or SVG"):
        validate_asset(PNG_1X1, "pixel.gif")


@pytest.mark.parametrize("payload", [
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><script/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20" onload="alert(1)"/>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><image href="https://example.com/x"/></svg>',
    b'<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 1 1"/>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><mask id="a"><g mask="url(#b)"/></mask><mask id="b"><g mask="url(#a)"/></mask></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" xmlns:e="urn:evil" viewBox="0 0 10 20"><e:path d="M0 0L1 1"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><?evil payload?></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><foreignObject/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><animate/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path style="fill:url(https://example.com/x)"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><linearGradient id="a" href="https://example.com/x"/></svg>',
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 20"><path fill="url(#missing)"/></svg>',
    b'<svg viewBox="0 0 10 20"><path d="M0 0L1 1"/></svg>',
])
def test_svg_rejects_the_whole_unsafe_document(payload: bytes) -> None:
    with pytest.raises(DecorAssetError):
        validate_asset(payload, "unsafe.svg")


def test_svg_utf16_doctype_is_rejected_before_entity_expansion() -> None:
    payload = '''<?xml version="1.0" encoding="UTF-16"?>
      <!DOCTYPE svg [
        <!ENTITY a "0123456789">
        <!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">
        <!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">
      ]>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
        <path d="&c;"/>
      </svg>'''.encode("utf-16")
    with pytest.raises(DecorAssetError, match="DTD, entities"):
        validate_asset(payload, "encoded.svg")


def test_svg_canonicalizes_safe_geometry_and_requires_aspect_ratio() -> None:
    asset = validate_asset(
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20"><path d="M0 0L1 1"/></svg>',
        "safe.svg",
    )
    assert (asset.width, asset.height, asset.mime) == (30, 20, "image/svg+xml")
    with pytest.raises(DecorAssetError, match="dimensions"):
        validate_asset(b'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', "bad.svg")


def test_svg_dimension_and_text_boundaries_fail_closed() -> None:
    with pytest.raises(DecorAssetError, match="viewBox"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10"><path/></svg>',
            "bad.svg",
        )
    with pytest.raises(DecorAssetError, match="dimensions"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" width="bad" height="20"><path/></svg>',
            "bad.svg",
        )
    with pytest.raises(DecorAssetError, match="safety limit"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20000 1"><path/></svg>',
            "large.svg",
        )
    with pytest.raises(DecorAssetError, match="SVG text"):
        validate_asset(
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path>text</path></svg>',
            "text.svg",
        )


def test_svg_preserves_safe_local_gradient_clip_mask_and_transparency() -> None:
    asset = validate_asset(b'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">
      <defs>
        <linearGradient id="base"><stop offset="0" stop-color="#fff" stop-opacity=".5"/></linearGradient>
        <linearGradient id="derived" href="#base"/>
        <clipPath id="clip"><rect width="20" height="20"/></clipPath>
        <mask id="mask"><circle cx="10" cy="10" r="8" fill="#fff"/></mask>
      </defs>
      <path d="M0 0L30 0L30 20Z" fill="url(#derived)" clip-path="url(#clip)"
        mask="url(#mask)" opacity=".8"/>
    </svg>''', "safe.svg", "image/svg+xml")
    assert asset.data.startswith(b'<svg xmlns="http://www.w3.org/2000/svg"')
    assert validate_asset(asset.data, "again.svg").asset_id == asset.asset_id


def test_svg_resource_limits_fail_closed() -> None:
    too_deep = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        + b'<g>' * 65 + b'</g>' * 65 + b'</svg>'
    )
    too_many = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        + b'<g/>' * 5000 + b'</svg>'
    )
    for payload in (too_deep, too_many):
        with pytest.raises(DecorAssetError, match="safety limit"):
            validate_asset(payload, "bounded.svg")


@pytest.mark.parametrize("attribute", [
    'opacity="NaN"', 'opacity="1.1"', 'stop-opacity="101%"', 'offset="-0.1"',
])
def test_svg_rejects_non_finite_or_out_of_range_unit_values(attribute: str) -> None:
    tag = "stop" if attribute.startswith(("stop", "offset")) else "path"
    payload = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'
        f'<{tag} {attribute}/></svg>'
    ).encode()
    with pytest.raises(DecorAssetError, match="invalid|range"):
        validate_asset(payload, "bounded.svg")


def test_svg_rejects_one_oversized_attribute_before_tree_use() -> None:
    payload = (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="'
        + b"M" * 65_537 + b'"/></svg>'
    )
    with pytest.raises(DecorAssetError, match="safety limit"):
        validate_asset(payload, "bounded.svg")


def test_truncated_raster_is_rejected_by_the_header_parser() -> None:
    """Обрезка на 33 байтах убирает `IEND`, поэтому файл отбивает парсер
    заголовка. До #430 этот тест назывался «by_full_decode» и записывался в
    доказательство декодирования — при no-op блока Pillow он оставался
    зелёным. Настоящий свидетель декодирования — тест ниже."""
    with pytest.raises(DecorAssetError, match="corrupt or has the wrong type"):
        validate_asset(PNG_1X1[:33], "truncated.png", "image/png")


def _png_with_corrupt_idat() -> bytes:
    """PNG, безупречный для парсера заголовка и мёртвый для декодера.

    Сигнатура, IHDR с честными 1x1, IEND на месте, длины и CRC всех чанков
    верны — придраться нечему, пока кто-нибудь не попробует распаковать IDAT,
    в котором лежит не zlib-поток, а текст.
    """
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return (struct.pack(">I", len(payload)) + kind + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 0, 0, 0, 0))
            + chunk(b"IDAT", b"not a zlib stream at all")
            + chunk(b"IEND", b""))


def test_valid_looking_png_is_rejected_by_the_full_pillow_decode() -> None:
    """Свидетель полного декодирования (#430, п.1 аудита v1.71.0-beta.1).

    Раньше блок `with Image.open(...) as image: image.load()` можно было
    заменить на no-op, и все 35 тестов файла оставались зелёными: заголовок
    отвечал на все вопросы, которые они задавали. Здесь спрашивается то, на
    что заголовок ответить не может, — распаковывается ли растр вообще.
    """
    pytest.importorskip("PIL", reason="полное декодирование делает Pillow")
    with pytest.raises(DecorAssetError, match="cannot be decoded"):
        validate_asset(_png_with_corrupt_idat(), "corrupt.png", "image/png")


def test_pillow_is_present_wherever_home_assistant_is() -> None:
    """Свидетель выше не имеет права молча пропускаться в каноне.

    `validate_asset` глотает `ImportError` осознанно: чистое подмножество
    тестов должно работать без всего HA. Цена — пропуск теста там, где Pillow
    нет, а пропущенный тест выглядит как пройденный. Поэтому в окружении с
    Home Assistant (Linux CI, WSL) отсутствие Pillow — красное само по себе.
    """
    pytest.importorskip("homeassistant", reason="чистая песочница без HA")
    importlib.import_module("PIL.Image")


def test_svg_asset_carries_canonical_bytes_not_the_upload() -> None:
    """Свидетель канонизации (#430, п.2). ТЗ §3 требует ре-сериализацию, а
    `ValidatedAsset(canonical, …)` → `ValidatedAsset(data, …)` не краснило ни
    один тест: все проверяли w/h/mime и ни один — сами байты.
    """
    raw = (b'<?xml version="1.0" encoding="utf-8"?>\n'
           b'<!-- pipeline comment -->\n'
           b'<svg  xmlns="http://www.w3.org/2000/svg"   viewBox="0 0 30 20" >'
           b'<rect x="0" y="0" width="1" height="1"></rect>'
           b'<title>a&gt;b</title>'
           b'</svg>')
    asset = validate_asset(raw, "canonical.svg")
    assert asset.data != raw
    assert not asset.data.startswith(b"<?xml"), "XML-пролог не переживает канонизацию"
    assert b"<!--" not in asset.data, "комментарий не переживает канонизацию"
    assert b"<rect " in asset.data and b"</rect>" not in asset.data, "пустой элемент сжимается"
    assert asset.data == (
        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">'
        b'<rect x="0" y="0" width="1" height="1" />'
        b'<title>a&gt;b</title>'
        b'</svg>'
    )


def test_svg_size_limit_applies_to_canonical_bytes() -> None:
    """Свидетель второй половины п.2: `_check_size(canonical)`.

    Экранирование `>` в тексте раздувает документ вчетверо, поэтому загрузка
    размером 1.84 МиБ канонизуется в 7.35 МиБ. Проверка размера на входе это
    пропускает; снятие `_check_size(canonical)` до #430 не краснило ничего, и
    в хранилище уезжал файл вчетверо больше объявленного предела.
    """
    payload = (b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">'
               + (b"<desc>" + b">" * 4096 + b"</desc>") * 470
               + b"</svg>")
    assert len(payload) < MAX_DECOR_ASSET_BYTES, "загрузка обязана проходить входной контроль"
    with pytest.raises(DecorAssetError, match="2 MiB"):
        validate_asset(payload, "canonical-bomb.svg")


@pytest.mark.parametrize("value", [
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "http://example.com/x",
    "https://example.com/x",
    "//example.com/x",
])
def test_svg_external_resource_guard_catches_what_no_other_rule_does(value: str) -> None:
    """Свидетель гарда внешних URL (#430, п.3).

    Все три «внешних» кейса корпуса ловились другими правилами: тегом не из
    словаря, атрибутом не из словаря, ветвью `name == "href"`. Замена условия
    на `if False:` не краснила ничего. Здесь тег и атрибут разрешённые, `url(`
    нет, `href` нет — сработать может только сам токен-гард, и сообщение это
    подтверждает.
    """
    payload = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20">'
        f'<path fill="{value}" d="M0 0L1 1"/></svg>'
    ).encode()
    with pytest.raises(DecorAssetError, match="External SVG resources are forbidden"):
        validate_asset(payload, "external.svg")


def test_catalog_ignores_missing_or_malformed_sidecars(tmp_path) -> None:
    aid = "a" * 64
    (tmp_path / f"{aid}.png").write_bytes(PNG_1X1)
    row = {"asset_id": aid, "ext": ".png", "mime": "image/png", "width": 1, "height": 1}
    (tmp_path / f"{aid}.json").write_text(json.dumps(row), encoding="utf-8")
    (tmp_path / "broken.json").write_text("{", encoding="utf-8")
    assert read_catalog(tmp_path) == [row]
    assert public_asset(row)["url"].endswith(f"/assets/_/{aid}.png")


def test_catalog_empty_directory_and_metadata_path(tmp_path) -> None:
    missing = tmp_path / "missing"
    aid = "c" * 64
    assert read_catalog(missing) == []
    assert asset_meta_path(tmp_path, aid) == tmp_path / f"{aid}.json"


def test_direct_asset_lookup_never_scans_or_accepts_mismatched_sidecars(
    tmp_path, monkeypatch,
) -> None:
    payload = b"one"
    aid = hashlib.sha256(payload).hexdigest()
    other = "d" * 64
    (tmp_path / f"{aid}.png").write_bytes(payload)
    (tmp_path / f"{aid}.json").write_text(json.dumps({
        "asset_id": aid, "ext": ".png", "mime": "image/png",
    }), encoding="utf-8")
    (tmp_path / f"{other}.json").write_text(json.dumps({
        "asset_id": aid, "ext": ".png", "mime": "image/png",
    }), encoding="utf-8")
    assert [row["asset_id"] for row in read_catalog(tmp_path)] == [aid]

    def no_scan(_self, _pattern):
        raise AssertionError("direct lookup must not scan the catalog")

    monkeypatch.setattr(Path, "glob", no_scan)
    assert read_asset(tmp_path, aid)["asset_id"] == aid
    assert read_asset(tmp_path, other) is None


def test_integrity_cache_reuses_digest_and_caches_corrupt_signature(tmp_path) -> None:
    payload = b"stable-content"
    path = tmp_path / "asset.bin"
    path.write_bytes(payload)
    expected = hashlib.sha256(payload).hexdigest()
    calls = 0

    def counted(candidate: Path) -> str:
        nonlocal calls
        calls += 1
        return hashlib.sha256(candidate.read_bytes()).hexdigest()

    verifier = AssetIntegrityVerifier(hasher=counted)
    assert verifier.verify(path, expected)
    assert verifier.verify(path, expected)
    assert calls == 1

    wrong = "0" * 64
    assert not verifier.verify(path, wrong)
    assert not verifier.verify(path, wrong)
    assert calls == 1, "the actual digest also caches a negative comparison"


def test_integrity_cache_invalidates_changed_signature_and_rejects_mid_read_change(
    tmp_path,
) -> None:
    path = tmp_path / "asset.bin"
    first = b"first"
    second = b"second-version"
    path.write_bytes(first)
    calls = 0

    def counted(candidate: Path) -> str:
        nonlocal calls
        calls += 1
        return hashlib.sha256(candidate.read_bytes()).hexdigest()

    verifier = AssetIntegrityVerifier(hasher=counted)
    assert verifier.verify(path, hashlib.sha256(first).hexdigest())
    path.write_bytes(second)
    assert verifier.verify(path, hashlib.sha256(second).hexdigest())
    assert calls == 2

    replacement = b"changed-during-read"

    def mutating(candidate: Path) -> str:
        original = candidate.read_bytes()
        candidate.write_bytes(replacement)
        return hashlib.sha256(original).hexdigest()

    unstable = AssetIntegrityVerifier(hasher=mutating)
    path.write_bytes(first)
    assert not unstable.verify(path, hashlib.sha256(first).hexdigest())
    assert not unstable._cache, "an unstable digest must not become a cache hit"


def test_integrity_cache_single_flights_same_path_and_releases_after_error(tmp_path) -> None:
    path = tmp_path / "asset.bin"
    payload = b"concurrent"
    path.write_bytes(payload)
    expected = hashlib.sha256(payload).hexdigest()
    waiter_joined = threading.Event()
    real_event = threading.Event

    class ObservedEvent:
        def __init__(self) -> None:
            self._event = real_event()

        def set(self) -> None:
            self._event.set()

        def wait(self, timeout=None) -> bool:
            waiter_joined.set()
            return self._event.wait(timeout)

    calls = 0

    def coordinated(candidate: Path) -> str:
        nonlocal calls
        calls += 1
        assert waiter_joined.wait(2), "the concurrent caller never joined the flight"
        return hashlib.sha256(candidate.read_bytes()).hexdigest()

    verifier = AssetIntegrityVerifier(hasher=coordinated, event_factory=ObservedEvent)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(verifier.verify, path, expected)
        second = pool.submit(verifier.verify, path, expected)
        assert first.result(timeout=3) and second.result(timeout=3)
    assert calls == 1

    attempts = 0

    def once_broken(candidate: Path) -> str:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise OSError("injected read failure")
        return hashlib.sha256(candidate.read_bytes()).hexdigest()

    recovered = AssetIntegrityVerifier(hasher=once_broken)
    assert not recovered.verify(path, expected)
    assert recovered.verify(path, expected)
    assert attempts == 2 and not recovered._inflight


def test_integrity_checks_for_different_paths_do_not_share_a_hash_lock(tmp_path) -> None:
    first_path = tmp_path / "first.bin"
    second_path = tmp_path / "second.bin"
    first_path.write_bytes(b"first")
    second_path.write_bytes(b"second")
    first_started = threading.Event()
    release_first = threading.Event()

    def coordinated(candidate: Path) -> str:
        if candidate == first_path:
            first_started.set()
            assert release_first.wait(2)
        return hashlib.sha256(candidate.read_bytes()).hexdigest()

    verifier = AssetIntegrityVerifier(hasher=coordinated)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(
            verifier.verify, first_path, hashlib.sha256(b"first").hexdigest(),
        )
        assert first_started.wait(1)
        independent = pool.submit(
            verifier.verify, second_path, hashlib.sha256(b"second").hexdigest(),
        )
        assert independent.result(timeout=1)
        release_first.set()
        assert first.result(timeout=2)


def test_integrity_cache_is_bounded_lru_and_stream_reader_avoids_read_bytes(
    tmp_path, monkeypatch,
) -> None:
    assert ASSET_INTEGRITY_CACHE_ENTRIES == 256
    paths = []
    for index in range(ASSET_INTEGRITY_CACHE_ENTRIES + 1):
        path = tmp_path / f"{index}.bin"
        path.write_bytes(str(index).encode())
        paths.append(path)

    verifier = AssetIntegrityVerifier()

    def forbidden_read_bytes(_self):
        raise AssertionError("integrity verification must stream chunks")

    monkeypatch.setattr(Path, "read_bytes", forbidden_read_bytes)
    for index in range(ASSET_INTEGRITY_CACHE_ENTRIES):
        assert verifier.verify(
            paths[index], hashlib.sha256(str(index).encode()).hexdigest(),
        )
    # Refresh zero, then the 257th insert must evict one rather than zero.
    assert verifier.verify(paths[0], hashlib.sha256(b"0").hexdigest())
    last = ASSET_INTEGRITY_CACHE_ENTRIES
    assert verifier.verify(paths[last], hashlib.sha256(str(last).encode()).hexdigest())
    assert len(verifier._cache) == ASSET_INTEGRITY_CACHE_ENTRIES
    assert str(paths[0].resolve()) in verifier._cache
    assert str(paths[1].resolve()) not in verifier._cache
    assert str(paths[last].resolve()) in verifier._cache


def test_reference_scan_is_cross_space_and_image_only() -> None:
    aid = "b" * 64
    refs = asset_refs({"spaces": [
        {"id": "one", "decor": [{"id": "a", "kind": "image", "asset_id": aid}]},
        {"id": "two", "decor": [
            {"id": "b", "kind": "image", "asset_id": aid},
            {"id": "c", "kind": "furniture", "asset_id": aid},
        ]},
    ]})
    assert refs[aid] == [
        {"space_id": "one", "decor_id": "a"},
        {"space_id": "two", "decor_id": "b"},
    ]


def test_reference_scan_skips_malformed_spaces_and_asset_ids() -> None:
    assert asset_refs({"spaces": [None, {"decor": [None, {
        "kind": "image", "asset_id": "not-a-content-hash",
    }]}]}) == {}
