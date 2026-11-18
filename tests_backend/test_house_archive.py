"""Closed house ZIP: independent bytes, dedup, refusal and bounded ingress."""
import base64
import hashlib
import json
import zipfile

import pytest
from test_house_document import exported

from custom_components.houseplan.core import house_archive
from custom_components.houseplan.core.house_document import parse_document
from custom_components.houseplan.core.house_prefix import canonical_prefix
from custom_components.houseplan.core.import_export import ImportFailure

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def document():
    result, _ = exported()
    for index, space in enumerate(result["payload"]["config"]["spaces"]):
        space["plan_url"] = f"/api/houseplan/content/plans/_/old{index}.png"
        space["decor"].append({"id": "picture", "kind": "image", "asset_id": hashlib.sha256(PNG).hexdigest(),
                               "x": .2, "y": .3, "w": .2, "h": .2})
    return parse_document(json.dumps(result).encode())


def archive(tmp_path, reader=lambda ref: (PNG, ".png")):
    path = tmp_path / "house.zip"
    manifest = house_archive.build_archive(path, document(), reader)
    return path, manifest


def rewrite(path, target, mutate, extra=None):
    with zipfile.ZipFile(path) as original, zipfile.ZipFile(target, "w") as changed:
        for info in original.infolist():
            raw = original.read(info.filename)
            raw = mutate(info.filename, raw)
            changed.writestr(info, raw)
        if extra is not None:
            changed.writestr(*extra)


def test_house_archive_has_canonical_prefix_and_one_blob_for_six_scoped_refs(tmp_path):
    path, manifest = archive(tmp_path)
    assert path.read_bytes()[:82] == canonical_prefix()
    assert manifest["format"] == "houseplan-plan-transfer" and manifest["archive_version"] == 1
    assert manifest["complete"] is True and len(manifest["images"]) == 6 and len(manifest["blobs"]) == 1
    assert len({row["ref"]["owner_id"] for row in manifest["images"]}) == 6
    with zipfile.ZipFile(path) as container:
        assert container.namelist()[0] == "mimetype"
        assert set(container.namelist()) == {"mimetype", "document.json", "manifest.json", *manifest["blobs"]}
    restored = house_archive.read_archive(path)
    expected = document()
    expected["created_at"] = restored.document["created_at"]
    assert restored.document == expected
    assert restored.manifest == manifest
    assert restored.archive_sha256 == hashlib.sha256(path.read_bytes()).hexdigest()
    assert list(tmp_path.iterdir()) == [path], "validation must not extract another complete image tree"


def test_source_missing_and_external_are_declared_without_network_or_attachment_collection(tmp_path):
    source = document()
    spaces = source["payload"]["config"]["spaces"]
    spaces[1]["plan_url"] = "https://user:secret@example.invalid/plan.png?token=private"
    spaces[2]["plan_url"] = "/api/houseplan/content/files/private-device/photo.png"
    accessed = []

    def read(ref):
        accessed.append(ref.record())
        if ref.kind == "plan":
            raise FileNotFoundError
        return PNG, ".png"

    path = tmp_path / "incomplete.zip"
    manifest = house_archive.build_archive(path, source, read)
    assert len(accessed) == 4, "three decor refs + one local backdrop; no remote/device attachment read"
    assert manifest["complete"] is False
    restored = house_archive.read_archive(path)
    assert {row.get("reason") for row in manifest["images"] if "reason" in row} == {"missing", "external", "invalid"}
    assert "secret" not in json.dumps(restored.document) and "token=private" not in json.dumps(manifest)
    repaired = house_archive.missing_projection(restored)
    assert repaired["payload"]["config"]["spaces"][0]["plan_url"] is None
    assert repaired["payload"]["config"]["spaces"][2]["plan_url"] is None
    assert repaired["payload"]["config"]["spaces"][1]["plan_url"].startswith("https://example.invalid/")


@pytest.mark.parametrize("key", ["key", "accessToken", "auth_sig", "client-secret", "X-Amz-Credential", "X-Goog-Signature", "%74oken"])
def test_external_image_query_credential_aliases_never_enter_portable_house(tmp_path, key):
    source = document()
    source["payload"]["config"]["spaces"][0]["plan_url"] = f"https://user:secret@example.invalid/plan.png?{key}=private&width=640"
    path = tmp_path / "clean.zip"
    house_archive.build_archive(path, source, lambda ref: (PNG, ".png"))
    restored = house_archive.read_archive(path)
    url = restored.document["payload"]["config"]["spaces"][0]["plan_url"]
    assert url == "https://example.invalid/plan.png?width=640"
    assert "private" not in json.dumps(restored.manifest)


@pytest.mark.parametrize("mutation", ["blob_hash", "mime", "owner", "duplicate_ref", "boolean_version", "unknown_entry", "traversal"])
def test_corrupt_or_forged_house_container_is_not_a_missing_image_import(tmp_path, mutation):
    path, manifest = archive(tmp_path)

    def change(name, raw):
        if mutation == "blob_hash" and name.startswith("images/"):
            return raw[:-1] + bytes([raw[-1] ^ 1])
        if name == "manifest.json":
            value = json.loads(raw)
            if mutation == "mime":
                next(iter(value["blobs"].values()))["mime"] = "text/html"
            elif mutation == "owner":
                value["images"][0]["ref"]["owner_id"] = "foreign-owner"
            elif mutation == "duplicate_ref":
                value["images"].append(value["images"][0])
            elif mutation == "boolean_version":
                value["archive_version"] = True
            return json.dumps(value).encode()
        return raw

    extra = ("extra.txt", b"not declared") if mutation == "unknown_entry" else ("../escape", b"bad") if mutation == "traversal" else None
    corrupted = tmp_path / "corrupt.zip"
    rewrite(path, corrupted, change, extra)
    with pytest.raises(ImportFailure):
        house_archive.read_archive(corrupted)
    assert not (tmp_path.parent / "escape").exists()


def test_entry_cap_is_checked_before_zipinfo_objects_are_constructed(tmp_path, monkeypatch):
    path, _ = archive(tmp_path)
    monkeypatch.setattr(house_archive, "MAX_ENTRIES", 3)

    def forbidden(*args, **kwargs):
        raise AssertionError("allocated ZipInfo before checking directory cap")

    monkeypatch.setattr(house_archive.zipfile, "ZipFile", forbidden)
    with pytest.raises(ImportFailure) as error:
        house_archive.read_archive(path)
    assert error.value.code == "zip_limit"


def test_known_future_prefix_and_nonhouse_fail_before_any_zip_read(tmp_path, monkeypatch):
    path = tmp_path / "not-house.zip"
    path.write_bytes(canonical_prefix(2))
    with pytest.raises(ImportFailure) as error:
        house_archive.read_archive(path)
    assert error.value.code == "unsupported-transfer"
    path.write_bytes(b"PK\x03\x04ordinary-backup")
    with pytest.raises(ImportFailure) as error:
        house_archive.read_archive(path)
    assert error.value.code == "not_plan_transfer"


def test_private_archive_changing_during_validation_is_not_a_trusted_snapshot(tmp_path, monkeypatch):
    path, _ = archive(tmp_path)
    original = house_archive.archive_digest
    calls = 0

    def changed_after_parse(value):
        nonlocal calls
        calls += 1
        if calls == 2:
            raw = path.read_bytes()
            path.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
        return original(value)

    monkeypatch.setattr(house_archive, "archive_digest", changed_after_parse)
    with pytest.raises(ImportFailure) as error:
        house_archive.read_archive(path)
    assert error.value.code == "zip_changed"
