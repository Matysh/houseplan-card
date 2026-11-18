"""House publication uses a distinct private ZIP and positive hardlink ownership."""
import copy
import hashlib
import json
import os

import pytest
from test_house_archive import PNG, document

from custom_components.houseplan.core import house_archive, house_files
from custom_components.houseplan.core.import_export import ImportFailure

SESSION = "e" * 32


def prepared(tmp_path, *, protected=frozenset()):
    folder = house_files.new_stage(tmp_path, SESSION)
    path = folder / "archive.zip"
    house_archive.build_archive(path, document(), lambda ref: (PNG, ".png"))
    payload = house_archive.read_archive(path)
    rewritten, descriptor = house_files.prepare_files(tmp_path, SESSION, payload, protected_plans=protected)
    return folder, rewritten, descriptor


def test_preview_retains_only_private_zip_and_publication_deduplicates_by_media_kind(tmp_path):
    folder, rewritten, descriptor = prepared(tmp_path)
    assert {p.name for p in folder.iterdir()} == {"owner.json", "archive.zip"}
    assert not (tmp_path / "houseplan/plans").exists()
    assert not (tmp_path / "houseplan/assets").exists()
    assert len(descriptor["files"]) == 3  # one backdrop, one decor blob, one sidecar
    spaces = rewritten["payload"]["config"]["spaces"]
    assert len({space["plan_url"] for space in spaces}) == 1
    assert len({space["decor"][-1]["asset_id"] for space in spaces}) == 1
    house_files.publish_files(tmp_path, descriptor)
    for item in descriptor["files"]:
        dest = tmp_path / item["dest"]
        assert dest.read_bytes() == (folder / item["stage"]).read_bytes()
        assert dest.stat().st_ino == (folder / item["stage"]).stat().st_ino
    house_files.publish_files(tmp_path, descriptor)  # recovery of a fully linked subset
    house_files.cleanup_stage(tmp_path, SESSION)
    assert not folder.exists()
    assert all((tmp_path / item["dest"]).exists() for item in descriptor["files"])


def test_reuses_verified_backdrop_asset_and_metadata_without_changing_existing_name(tmp_path):
    folder, _, descriptor = prepared(tmp_path)
    house_files.publish_files(tmp_path, descriptor)
    house_files.cleanup_stage(tmp_path, SESSION)
    side = next(tmp_path / item["dest"] for item in descriptor["files"] if item["kind"] == "decor_meta")
    metadata = json.loads(side.read_bytes())
    metadata["name"] = "Target's existing display name"
    side.write_text(json.dumps(metadata))
    _, _, repeated = prepared(tmp_path)
    assert all(item["reuse"] for item in repeated["files"])
    house_files.publish_files(tmp_path, repeated)
    house_files.rollback_publication(tmp_path, repeated)
    assert all((tmp_path / item["dest"]).exists() for item in repeated["files"])
    assert json.loads(side.read_bytes())["name"] == metadata["name"]
    assert {p.name for p in folder.iterdir()} == {"owner.json", "archive.zip"}


def test_target_orphan_backdrop_is_not_implicitly_repaired(tmp_path):
    name = f"house.{hashlib.sha256(PNG).hexdigest()}.png"
    _, rewritten, descriptor = prepared(tmp_path, protected={name})
    assert all(not space["plan_url"].endswith("/" + name) for space in rewritten["payload"]["config"]["spaces"])
    house_files.publish_files(tmp_path, descriptor)
    assert not (tmp_path / "houseplan/plans" / name).exists()


def test_rollback_removes_only_owned_links_and_preserves_equal_strangers(tmp_path):
    _, _, descriptor = prepared(tmp_path)
    house_files.publish_files(tmp_path, descriptor)
    stranger = tmp_path / descriptor["files"][0]["dest"]
    raw = stranger.read_bytes()
    stranger.unlink()
    stranger.write_bytes(raw)
    house_files.rollback_publication(tmp_path, descriptor)
    assert stranger.read_bytes() == raw
    assert all(not (tmp_path / item["dest"]).exists() for item in descriptor["files"][1:])


def test_partial_publication_recovers_and_rollback_is_idempotent(tmp_path, monkeypatch):
    _, _, descriptor = prepared(tmp_path)
    publish = house_files.publish_file
    calls = 0

    def interrupt(root, folder, item):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("simulated crash")
        publish(root, folder, item)

    monkeypatch.setattr(house_files, "publish_file", interrupt)
    with pytest.raises(OSError):
        house_files.publish_files(tmp_path, descriptor)
    assert (tmp_path / descriptor["files"][0]["dest"]).exists()
    monkeypatch.setattr(house_files, "publish_file", publish)
    house_files.publish_files(tmp_path, descriptor)
    house_files.rollback_publication(tmp_path, descriptor)
    house_files.rollback_publication(tmp_path, descriptor)
    assert all(not (tmp_path / item["dest"]).exists() for item in descriptor["files"])


def test_changed_archive_and_reused_bytes_refuse_before_first_new_link(tmp_path):
    folder, _, descriptor = prepared(tmp_path)
    path = folder / "archive.zip"
    raw = path.read_bytes()
    path.write_bytes(raw[:-1] + bytes([raw[-1] ^ 1]))
    with pytest.raises(ImportFailure):
        house_files.publish_files(tmp_path, descriptor)
    assert all(not (tmp_path / item["dest"]).exists() for item in descriptor["files"])
    path.write_bytes(raw)
    house_files.publish_files(tmp_path, descriptor)
    house_files.cleanup_stage(tmp_path, SESSION)
    _, _, repeated = prepared(tmp_path)
    (tmp_path / repeated["files"][0]["dest"]).write_bytes(b"changed")
    with pytest.raises(ImportFailure):
        house_files.publish_files(tmp_path, repeated)


@pytest.mark.parametrize("mutation", ["attachment", "traversal", "stage_path", "boolean_version", "source_path", "symlink_archive"])
def test_recovery_descriptor_is_closed_and_refuses_unsafe_paths(tmp_path, mutation):
    folder, _, original = prepared(tmp_path)
    descriptor = copy.deepcopy(original)
    if mutation == "attachment":
        descriptor["files"][0]["dest"] = "houseplan/files/device/private.png"
    elif mutation == "traversal":
        descriptor["files"][0]["dest"] = "houseplan/plans/../../escape.png"
    elif mutation == "stage_path":
        descriptor["files"][0]["stage"] = "../archive.zip"
    elif mutation == "boolean_version":
        descriptor["version"] = True
    elif mutation == "source_path":
        descriptor["files"][0]["source"] = "../image.png"
    else:
        archive = folder / "archive.zip"
        archive.rename(folder / "saved.zip")
        archive.symlink_to(folder / "saved.zip")
    with pytest.raises(ImportFailure):
        house_files.publish_files(tmp_path, descriptor)
    assert all(not (tmp_path / item["dest"]).exists() for item in original["files"])


def test_house_cleanup_refuses_full_backup_marker_and_unknown_children(tmp_path):
    folder = house_files.new_stage(tmp_path, SESSION)
    marker = folder / "owner.json"
    original = marker.read_bytes()
    marker.write_text(json.dumps({"format": "houseplan-backup-staging/v1", "session": SESSION}))
    with pytest.raises(ImportFailure):
        house_files.cleanup_stage(tmp_path, SESSION)
    marker.write_bytes(original)
    (folder / "unknown").write_bytes(b"keep")
    with pytest.raises(ImportFailure):
        house_files.cleanup_stage(tmp_path, SESSION)
    assert (folder / "unknown").read_bytes() == b"keep"


def test_symlink_destination_is_not_followed(tmp_path):
    _, _, descriptor = prepared(tmp_path)
    dest = tmp_path / descriptor["files"][0]["dest"]
    dest.parent.mkdir(parents=True)
    foreign = tmp_path / "foreign.png"
    foreign.write_bytes(PNG)
    os.symlink(foreign, dest)
    with pytest.raises(ImportFailure):
        house_files.publish_files(tmp_path, descriptor)
    assert foreign.read_bytes() == PNG and dest.is_symlink()
