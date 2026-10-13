"""Previous-installation discovery and byte-preserving archive contracts (#820)."""
import errno
import json
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from custom_components.houseplan import previous_data as previous
from custom_components.houseplan.const import STORAGE_MINOR_VERSION


def seed(root: Path) -> None:
    for key in previous.STORE_KEYS:
        path = root / ".storage" / key
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {"config": {"spaces": [{"id": "old"}, {"id": "other"}]} }
        path.write_text(json.dumps({
            "version": 1, "minor_version": STORAGE_MINOR_VERSION,
            "key": key, "data": data,
        }))
    for name in previous.DATA_DIRS:
        path = root / name / "nested" / "old.bin"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"\x00\xffold:" + name.encode())
    (root / "houseplan/plans/empty").mkdir()


def snapshot(root: Path) -> dict:
    return {
        str(p.relative_to(root)): (p.read_bytes() if p.is_file() else None, p.stat().st_mtime_ns)
        for p in root.rglob("*") if not p.is_symlink()
    }


def byteset(root: Path) -> dict:
    return {str(p.relative_to(root)): p.read_bytes() for p in root.rglob("*") if p.is_file()}


def store(root: Path, key: str, data) -> Path:
    path = root / ".storage" / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "version": 1, "minor_version": STORAGE_MINOR_VERSION, "key": key, "data": data,
    }))
    return path


def seed_spaceless(root: Path, *, config: bool = True, markers=()) -> None:
    """#877: no spaces, but markers, a settled layout, trails and an attachment."""
    if config:
        store(root, "houseplan.config", {"config": {"spaces": [], "markers": list(markers)}, "rev": 4})
    store(root, "houseplan.layout", {"layout": {"m1": {"x": 0.2, "y": 0.3}}, "rev": 2})
    store(root, "houseplan.trails", {})
    path = root / "houseplan/files/nested/manual.pdf"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"%PDF-old")


SPACELESS = {
    "markers": {"markers": [{"id": "m1", "binding": "device:abc"}]},
    "no-markers": {"markers": []},
    "no-config": {"config": False},
}


def test_no_data_and_archive_only(tmp_path):
    assert not previous.inspect_previous_data(str(tmp_path)).found
    for name in previous.DATA_DIRS:
        (tmp_path / name).mkdir(parents=True)
    assert not previous.inspect_previous_data(str(tmp_path)).found
    path = tmp_path / "houseplan/archive/older/storage/houseplan.config"
    path.parent.mkdir(parents=True)
    path.write_bytes(b"older")
    before = snapshot(tmp_path)
    assert not previous.inspect_previous_data(str(tmp_path)).found
    assert previous.archive_previous_data(str(tmp_path)) is None
    assert snapshot(tmp_path) == before


@pytest.mark.parametrize("key", previous.STORE_KEYS)
def test_single_store_is_data(tmp_path, key):
    path = tmp_path / ".storage" / key
    path.parent.mkdir()
    path.write_bytes(b"unreadable")
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and summary.files == 0
    assert summary.modified == path.stat().st_mtime


def test_summary_read_only(tmp_path):
    seed(tmp_path)
    files = sorted(p for p in tmp_path.rglob("*") if p.is_file())
    for index, path in enumerate(files):
        os.utime(path, (1700000000 + index, 1700000000 + index))
    ignored = tmp_path / "houseplan/archive/future/ignored"
    ignored.parent.mkdir(parents=True)
    ignored.write_bytes(b"not active")
    os.utime(ignored, (2000000000, 2000000000))
    before = snapshot(tmp_path)
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and summary.spaces == 2 and summary.files == 3 and not summary.empty
    assert summary.modified == 1700000000 + len(files) - 1
    assert snapshot(tmp_path) == before


def test_legacy_summary_does_not_migrate(tmp_path):
    seed(tmp_path)
    path = tmp_path / ".storage/houseplan.config"
    envelope = json.loads(path.read_text())
    envelope["minor_version"] = 1
    path.write_text(json.dumps(envelope))
    before = snapshot(tmp_path)
    assert previous.inspect_previous_data(str(tmp_path)).spaces == 2
    assert snapshot(tmp_path) == before
    assert "settings" not in json.loads(path.read_text())["data"]["config"]


@pytest.mark.parametrize("payload", [
    b"not json", b"[]", b'{"version": 99, "data": {"config": {"spaces": []}}}',
    b'{"version": 1, "minor_version": 99, "data": {"config": {"spaces": []}}}',
    b'{"version": 1, "data": {"config": {"spaces": "bad"}}}',
    b'{"version": 1, "data": {"config": {"spaces": [1]}}}',
])
def test_unreadable_count(tmp_path, payload):
    seed(tmp_path)
    (tmp_path / ".storage/houseplan.config").write_bytes(payload)
    before = snapshot(tmp_path)
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and summary.spaces is None and summary.files == 3
    assert snapshot(tmp_path) == before


@pytest.mark.parametrize("variant", SPACELESS)
def test_spaceless_is_empty(tmp_path, variant):
    seed_spaceless(tmp_path, **SPACELESS[variant])
    before = snapshot(tmp_path)
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and summary.spaces == 0 and summary.files == 1
    assert summary.empty
    assert snapshot(tmp_path) == before


@pytest.mark.parametrize("markers", [[], [{"id": "m1", "binding": "device:abc"}]])
def test_one_space_is_not_empty(tmp_path, markers):
    seed_spaceless(tmp_path)
    store(tmp_path, "houseplan.config", {"config": {"spaces": [{"id": "old"}], "markers": markers}})
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and summary.spaces == 1 and not summary.empty


PENDING = {"layout": {}, "rev": 2, "optimize_pending": {"config": {"spaces": [{"id": "new"}]}, "layout": {}}}


@pytest.mark.parametrize(("name", "payload"), [
    ("houseplan.config", b"not json"),
    ("houseplan.config", b'{"version": 99, "data": {"config": {"spaces": []}}}'),
    ("houseplan.config", b'{"version": 1, "data": {"config": {"spaces": "bad"}}}'),
    ("houseplan.layout", b"not json"),
    ("houseplan.layout", b"[]"),
    ("houseplan.layout", b'{"version": 1, "data": []}'),
    ("houseplan.layout", json.dumps({"version": 1, "data": PENDING}).encode()),
], ids=["config-json", "config-version", "spaces-not-list",
        "layout-json", "layout-array", "layout-data-array", "layout-pending"])
def test_unknown_is_not_empty(tmp_path, name, payload):
    """#877 AC3: unreadable data or a pending pair never counts as no spaces."""
    seed_spaceless(tmp_path)
    (tmp_path / ".storage" / name).write_bytes(payload)
    before = snapshot(tmp_path)
    summary = previous.inspect_previous_data(str(tmp_path))
    assert summary.found and not summary.empty
    assert summary.spaces == (None if name == "houseplan.config" else 0)
    assert snapshot(tmp_path) == before


def test_unsafe_is_not_empty(tmp_path):
    root = tmp_path / "ha"
    external = tmp_path / "external"
    root.mkdir()
    external.mkdir()
    seed_spaceless(root)
    (root / "houseplan/files/link").symlink_to(external, target_is_directory=True)
    summary = previous.inspect_previous_data(str(root))
    assert summary.found and summary.unsafe and summary.spaces is None and not summary.empty


def test_layout_read_only_without_spaces(tmp_path, monkeypatch):
    seed(tmp_path)
    opened = []
    open_file = Path.open

    def record(path, *args, **kwargs):
        opened.append(path.name)
        return open_file(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", record)
    assert not previous.inspect_previous_data(str(tmp_path)).empty
    assert opened == ["houseplan.config"]
    store(tmp_path, "houseplan.config", {"config": {"spaces": []}})
    opened.clear()
    assert previous.inspect_previous_data(str(tmp_path)).empty
    assert opened == ["houseplan.config", "houseplan.layout"]


def test_archive_roundtrip(tmp_path):
    seed(tmp_path)
    before = byteset(tmp_path)
    archive = previous.archive_previous_data(str(tmp_path))
    assert archive.parent == tmp_path / "houseplan/archive"
    expected = {key.replace(".storage/", "storage/").replace("houseplan/", "", 1): value
                for key, value in before.items()}
    assert byteset(archive) == expected
    assert (archive / "plans/empty").is_dir()
    assert not any((tmp_path / ".storage" / key).exists() for key in previous.STORE_KEYS)
    assert not any((tmp_path / name).exists() for name in previous.DATA_DIRS)
    assert not previous.inspect_previous_data(str(tmp_path)).found


def test_second_archive(tmp_path):
    seed(tmp_path)
    first = previous.archive_previous_data(str(tmp_path))
    before = snapshot(first)
    seed(tmp_path)
    second = previous.archive_previous_data(str(tmp_path))
    assert first != second
    assert snapshot(first) == before
    assert byteset(first) == byteset(second)
    assert not previous.inspect_previous_data(str(tmp_path)).found


def test_second_rename_failure_rolls_back(tmp_path, monkeypatch):
    seed(tmp_path)
    before = byteset(tmp_path)
    before_files = {p: value for p, value in snapshot(tmp_path).items() if value[0] is not None}
    rename = Path.rename
    calls = []

    def fail_second(path, destination):
        calls.append((path, destination))
        if len(calls) == 2:
            raise PermissionError("second rename refused")
        return rename(path, destination)

    monkeypatch.setattr(Path, "rename", fail_second)
    with pytest.raises(previous.ArchiveError):
        previous.archive_previous_data(str(tmp_path))
    assert len(calls) == 3 and calls[2] == (calls[0][1], calls[0][0])
    assert byteset(tmp_path) == before
    assert {p: value for p, value in snapshot(tmp_path).items() if value[0] is not None} == before_files
    assert not (tmp_path / "houseplan/archive").exists()


@pytest.mark.parametrize("error", [errno.ENOSPC, errno.EACCES])
def test_mkdir_failure_preserves_data(tmp_path, monkeypatch, error):
    seed(tmp_path)
    before = snapshot(tmp_path)
    mkdir = Path.mkdir

    def fail_mkdir(path, *args, **kwargs):
        if path.name == "archive":
            raise OSError(error, "cannot create archive")
        return mkdir(path, *args, **kwargs)

    monkeypatch.setattr(Path, "mkdir", fail_mkdir)
    with pytest.raises(previous.ArchiveError):
        previous.archive_previous_data(str(tmp_path))
    assert snapshot(tmp_path) == before


def test_cross_filesystem_rejected_before_move(tmp_path, monkeypatch):
    seed(tmp_path)
    before = snapshot(tmp_path)
    lstat = Path.lstat

    def other_device(path):
        info = lstat(path)
        if path.name == "houseplan.layout":
            return SimpleNamespace(st_mode=info.st_mode, st_mtime=info.st_mtime, st_dev=info.st_dev + 1)
        return info

    monkeypatch.setattr(Path, "lstat", other_device)
    with pytest.raises(previous.ArchiveError) as error:
        previous.archive_previous_data(str(tmp_path))
    assert error.value.__cause__.errno == errno.EXDEV
    monkeypatch.setattr(Path, "lstat", lstat)
    assert snapshot(tmp_path) == before


@pytest.mark.parametrize("location", [
    ".storage", "houseplan", ".storage/houseplan.config", "houseplan/plans",
    "houseplan/files/nested", "houseplan/assets/link", "houseplan/archive",
])
def test_symlinks_never_followed_or_moved(tmp_path, monkeypatch, location):
    root = tmp_path / "ha"
    external = tmp_path / "external"
    root.mkdir()
    external.mkdir()
    (external / "sentinel").write_bytes(b"untouched")
    if location == "houseplan/archive":
        seed(root)
    target = root / location
    target.parent.mkdir(parents=True, exist_ok=True)
    target.symlink_to(external, target_is_directory=True)
    scandir = os.scandir

    def guarded_scan(path):
        assert Path(path).resolve() != external, "detector followed an external link"
        return scandir(path)

    monkeypatch.setattr(os, "scandir", guarded_scan)
    if location != "houseplan/archive":
        assert previous.inspect_previous_data(str(root)).unsafe
    with pytest.raises(previous.ArchiveError):
        previous.archive_previous_data(str(root))
    assert target.is_symlink()
    assert (external / "sentinel").read_bytes() == b"untouched"
    assert not (external / "archive").exists()


def test_collision_preserves_existing_archive(tmp_path, monkeypatch):
    seed(tmp_path)
    older = tmp_path / "houseplan/archive/same"
    older.mkdir(parents=True)
    (older / "keep").write_bytes(b"older")
    before = snapshot(tmp_path)
    monkeypatch.setattr(previous, "_archive_name", lambda: "same")
    with pytest.raises(previous.ArchiveError):
        previous.archive_previous_data(str(tmp_path))
    assert snapshot(tmp_path) == before


def test_failed_rollback_retains_bytes_and_logs_path(tmp_path, monkeypatch, caplog):
    seed(tmp_path)
    before = sorted(byteset(tmp_path).values())
    rename = Path.rename
    calls = 0

    def fail_after_first(path, destination):
        nonlocal calls
        calls += 1
        if calls > 1:
            raise PermissionError("media unavailable")
        return rename(path, destination)

    monkeypatch.setattr(Path, "rename", fail_after_first)
    with pytest.raises(previous.ArchiveError) as error:
        previous.archive_previous_data(str(tmp_path))
    assert sorted(byteset(tmp_path).values()) == before
    assert error.value.archive_path.exists()
    assert str(error.value.archive_path) in caplog.text
