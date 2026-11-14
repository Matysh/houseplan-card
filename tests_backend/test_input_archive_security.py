"""#1395: archive paths/links/CRC/actual stream bounds, with valid neighbours."""
from __future__ import annotations

import copy
import io
import stat
import struct
import warnings
import zipfile
from dataclasses import replace

import pytest

from custom_components.houseplan.core import backup_archive as archive
from custom_components.houseplan.core.import_export import ImportFailure
from custom_components.houseplan.core.input_policy import (
    STRICT_INPUT_POLICY,
    input_scope,
)
from tests_backend.test_input_policy import document


def backup(tmp_path, extra=None):
    root = tmp_path / "source"
    root.mkdir()
    value = document(root, extra)
    path = tmp_path / "source.zip"
    archive.build_archive(path, value, root, {})
    return path, value


def read(path, tmp_path, name="stage"):
    stage = tmp_path / name
    stage.mkdir()
    return archive.read_archive(path, stage)


@pytest.mark.parametrize("encoding", ["utf-16", "utf-32"])
def test_strict_manifest_encoding_refusal_preserves_ha_compatibility(tmp_path, encoding):
    path, value = backup(tmp_path)
    with zipfile.ZipFile(path) as source:
        entries = {name: source.read(name) for name in source.namelist()}
    entries["manifest.json"] = entries["manifest.json"].decode("utf-8").encode(encoding)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as output:
        for name, raw in entries.items():
            output.writestr(name, raw)
    assert read(path, tmp_path, "ha").document["kind"] == value["kind"]
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        with pytest.raises(ImportFailure) as error:
            read(path, tmp_path, "strict")
        assert error.value.code == "invalid_json"
        assert error.value.reason == "json_encoding"
    assert list((tmp_path / "strict").iterdir()) == []


@pytest.mark.parametrize("operation", ["expanded", "read"])
@pytest.mark.parametrize("reason", ["cancelled", "time"])
def test_directory_budget_errors_use_the_archive_domain_contract(tmp_path, operation, reason):
    path, _ = backup(tmp_path)
    now, cancelled = [0.0], [False]
    with pytest.raises(ImportFailure) as error:
        with input_scope(STRICT_INPUT_POLICY, clock=lambda: now[0], cancel=lambda: cancelled[0]):
            if reason == "cancelled":
                cancelled[0] = True
            else:
                now[0] = 5.1
            archive.expanded_size(path) if operation == "expanded" else read(path, tmp_path)
    assert error.value.reason == reason
    assert error.value.code == ("zip_cancelled" if reason == "cancelled" else "capacity_exceeded")
    assert not (tmp_path / "stage").exists() or list((tmp_path / "stage").iterdir()) == []


@pytest.mark.parametrize("name", [
    "../outside", "/absolute", "C:/file", "images//file", "images/./file",
    "images/../../file", "windows\\file", "nul\x00hidden",
])
def test_untrusted_names_never_select_output_paths(tmp_path, name):
    path, value = backup(tmp_path)
    before = copy.deepcopy(value)
    assert read(path, tmp_path, "positive").document["kind"] == "full"
    with zipfile.ZipFile(path, "a") as out:
        out.writestr(name.replace("\x00", "_"), b"not a path authority")
    if "\x00" in name:
        # ZipFile's writer truncates a literal NUL. Put it into both real
        # headers instead, retaining their length, to exercise the reader.
        raw = path.read_bytes().replace(name.replace("\x00", "_").encode(), name.encode())
        path.write_bytes(raw)
    with pytest.raises(ImportFailure):
        read(path, tmp_path)
    assert value == before
    assert not (tmp_path / "outside").exists()
    assert list((tmp_path / "stage").iterdir()) == []


@pytest.mark.parametrize("kind", ["symlink", "directory", "duplicate", "unsupported-method", "encrypted"])
def test_unsupported_entry_shapes_fail_before_any_staging_write(tmp_path, kind):
    path, _ = backup(tmp_path)
    assert read(path, tmp_path, "positive").document["kind"] == "full"
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)  # deliberate duplicate entry
        with zipfile.ZipFile(path, "a") as out:
            info = zipfile.ZipInfo("manifest.json" if kind == "duplicate" else "images/probe")
            if kind == "symlink":
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
            elif kind == "directory":
                info.external_attr = (stat.S_IFDIR | 0o755) << 16
            elif kind == "unsupported-method":
                info.compress_type = zipfile.ZIP_BZIP2
            out.writestr(info, b"probe")
    if kind == "encrypted":
        raw = bytearray(path.read_bytes())
        # Flag the actual newly added local and central headers. ZipFile does
        # not create encrypted files itself; the parser must reject the flag.
        for signature, offset in [(b"PK\x03\x04", 6), (b"PK\x01\x02", 8)]:
            index = raw.rfind(signature)
            flags = struct.unpack_from("<H", raw, index + offset)[0]
            struct.pack_into("<H", raw, index + offset, flags | 1)
        path.write_bytes(raw)
    with pytest.raises(ImportFailure):
        read(path, tmp_path)
    assert list((tmp_path / "stage").iterdir()) == []


def test_crc_corruption_and_truncation_refuse_without_a_public_document(tmp_path):
    path, _ = backup(tmp_path)
    raw = path.read_bytes()
    assert read(path, tmp_path, "positive").document["kind"] == "full"
    with zipfile.ZipFile(path) as source:
        entry = source.getinfo("document.json")
    changed = bytearray(raw)
    position = entry.header_offset + 30 + len(entry.filename.encode()) + len(entry.extra)
    changed[position + entry.compress_size // 2] ^= 1
    for index, payload in enumerate((changed, raw[:-5])):
        broken = tmp_path / f"broken-{index}.zip"
        broken.write_bytes(payload)
        with pytest.raises(ImportFailure):
            read(broken, tmp_path, f"stage-{index}")
        assert list((tmp_path / f"stage-{index}").iterdir()) == []


def test_high_ratio_is_not_a_reason_to_reject_a_small_valid_backup(tmp_path):
    path, _ = backup(tmp_path, "0" * 100_000)
    assert archive.expanded_size(path) / path.stat().st_size > 50
    with input_scope(STRICT_INPUT_POLICY, clock=lambda: 0):
        assert read(path, tmp_path).document["payload"]["config"]["extra"] == "0" * 100_000


@pytest.mark.parametrize("offset", [-1, 0, 1])
def test_real_zip_archive_and_expanded_limits_have_exact_boundaries(tmp_path, offset):
    path, _ = backup(tmp_path)
    size, expanded = path.stat().st_size, archive.expanded_size(path)
    for field, limit in [("archive_bytes", size), ("expanded_bytes", expanded)]:
        policy = replace(STRICT_INPUT_POLICY, **{field: limit + offset})
        if offset < 0:
            with pytest.raises(ImportFailure) as error:
                with input_scope(policy, clock=lambda: 0):
                    read(path, tmp_path, field)
            assert error.value.code == "zip_limit"
        else:
            with input_scope(policy, clock=lambda: 0):
                assert read(path, tmp_path, field).document["kind"] == "full"


def test_actual_streamed_bytes_are_bounded_even_if_metadata_claims_less(tmp_path, monkeypatch):
    path, _ = backup(tmp_path)
    original = zipfile.ZipFile
    monkeypatch.setattr(archive, "MAX_MANIFEST_BYTES", 128)
    class DishonestReader:
        def __init__(self, *_args, **_kwargs):
            self.source = original(path)
            self.infos = self.source.infolist()
            for info in self.infos:
                if info.filename == "manifest.json":
                    info.file_size = 1
        def __enter__(self):
            return self
        def __exit__(self, *_args):
            self.source.close()
        def infolist(self):
            return self.infos
        def getinfo(self, name):
            return next(i for i in self.infos if i.filename == name)
        def open(self, _info):
            return io.BytesIO(b" " * 129)
    monkeypatch.setattr(archive.zipfile, "ZipFile", DishonestReader)
    with pytest.raises(ImportFailure) as error:
        read(path, tmp_path)
    assert error.value.code == "zip_limit"
    assert list((tmp_path / "stage").iterdir()) == []


@pytest.mark.parametrize("actual_count", [2, 1601])
def test_actual_central_directory_count_is_checked_before_zipinfo_allocation(tmp_path, monkeypatch, actual_count):
    path = tmp_path / "forged-directory.zip"
    with zipfile.ZipFile(path, "w") as out:
        for index in range(actual_count):
            out.writestr(f"entry-{index}", b"x")
    raw = bytearray(path.read_bytes())
    end = raw.rfind(b"PK\x05\x06")
    struct.pack_into("<HH", raw, end + 8, 1, 1)  # EOCD falsely claims one entry.
    path.write_bytes(raw)
    def forbidden(*_args, **_kwargs):
        raise AssertionError("ZipInfo allocation happened before actual directory count proof")
    monkeypatch.setattr(archive.zipfile, "ZipFile", forbidden)
    stage = tmp_path / "stage"
    stage.mkdir()
    with pytest.raises(ImportFailure):
        archive.read_archive(path, stage)
    assert list(stage.iterdir()) == []
