"""Large writes keep purpose, authority, digest, byte and one-shot boundaries."""
import hashlib
import json

import pytest

from custom_components.houseplan import structural_upload as module
from custom_components.houseplan.structural_upload import StructuralUploads, UploadError


def staged(manager, owner="alice", message=None):
    message = message or {"type": "houseplan/config/set", "expected_rev": 7,
                           "config": {"spaces": [], "note": "Кухня"}}
    raw = json.dumps(message, ensure_ascii=False).encode()
    token = manager.begin(owner, len(raw))
    manager.append(token, owner, raw[:9])
    manager.append(token, owner, raw[9:])
    reply = manager.finish(token, owner)
    assert reply["sha256"] == hashlib.sha256(raw).hexdigest()
    compact = {"id": 42, "type": message["type"], "upload_token": token,
               "upload_sha256": reply["sha256"],
               **{key: message[key] for key in module.CONTROL_KEYS if key in message}}
    return compact, message


def test_exact_payload_digest_and_single_use_preserve_ordinary_command():
    manager = StructuralUploads()
    compact, original = staged(manager)
    assert manager.resolve(compact, "alice") == {**original, "id": 42}
    manager.consume(compact["upload_token"], "alice")
    with pytest.raises(UploadError, match="upload_expired"):
        manager.resolve(compact, "alice")


@pytest.mark.parametrize("change,code", [
    ({"type": "houseplan/plan/optimize"}, "upload_purpose"),
    ({"expected_rev": 8}, "upload_control_mismatch"),
    ({"expected_rev": True}, "upload_control_mismatch"),
    ({"upload_sha256": "0" * 64}, "upload_digest_mismatch"),
    ({"config": {}}, "invalid_format"),
    ({"action": "undo"}, "upload_control_mismatch"),
])
def test_compact_message_cannot_change_staged_authority(change, code):
    manager = StructuralUploads()
    compact, _ = staged(manager)
    with pytest.raises(UploadError, match=code):
        manager.resolve({**compact, **change}, "alice")


def test_other_user_expiry_replacement_and_cancellation():
    now = [10]
    manager = StructuralUploads(clock=lambda: now[0])
    compact, _ = staged(manager)
    with pytest.raises(UploadError, match="owner_mismatch"):
        manager.resolve(compact, "bob")
    manager.cancel(compact["upload_token"], "bob")
    assert manager.resolve(compact, "alice")
    replacement, _ = staged(manager)
    with pytest.raises(UploadError, match="expired"):
        manager.resolve(compact, "alice")
    now[0] = 130
    with pytest.raises(UploadError, match="expired"):
        manager.resolve(replacement, "alice")


def test_stream_limits_include_all_users_and_cannot_trust_declared_length(monkeypatch):
    monkeypatch.setattr(module, "MAX_UPLOAD_BYTES", 10)
    monkeypatch.setattr(module, "MAX_STAGED_BYTES", 15)
    manager = StructuralUploads()
    alice, bob = manager.begin("alice", 1), manager.begin("bob")
    manager.append(alice, "alice", b"x" * 10)
    with pytest.raises(UploadError, match="capacity"):
        manager.append(bob, "bob", b"x" * 6)
    assert bob not in manager.uploads
    with pytest.raises(UploadError, match="too_large"):
        manager.append(alice, "alice", b"x")
    assert not manager.uploads


@pytest.mark.parametrize("raw", [b'{"type":"houseplan/config/set","type":"other"}',
    b'{"type":"houseplan/config/set","config":{"number":NaN}}',
    b'{"type":"houseplan/config/set","id":1}', b'{"type":"houseplan/import/apply"}'])
def test_malformed_or_wrong_purpose_upload_has_no_retained_candidate(raw):
    manager = StructuralUploads()
    token = manager.begin("alice")
    manager.append(token, "alice", raw)
    with pytest.raises(UploadError):
        manager.finish(token, "alice")
    assert not manager.uploads
