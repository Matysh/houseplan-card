"""WebSocket API tests (CI): layout ops, config rev conflict, not_ready gate."""
import pytest


@pytest.fixture(autouse=True)
def _enable_custom_integrations(enable_custom_integrations):
    """Allow loading custom_components in the test hass."""
    yield

from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.houseplan.const import DOMAIN


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="House Plan", data={}, options={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_layout_roundtrip(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert resp["success"] and resp["result"]["layout"] == {}

    await client.send_json_auto_id(
        {"type": "houseplan/layout/set", "layout": {"dev1": {"s": "f1", "x": 0.5, "y": 0.5}}}
    )
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id(
        {"type": "houseplan/layout/update", "device_id": "dev2", "pos": {"s": "f1", "x": 0.1, "y": 0.2}}
    )
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "houseplan/layout/delete", "device_id": "dev1"})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert set(resp["result"]["layout"]) == {"dev2"}


async def test_config_rev_conflict(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    cfg = {"spaces": [], "markers": [], "settings": {}}

    await client.send_json_auto_id({"type": "houseplan/config/set", "config": cfg, "expected_rev": 0})
    resp = await client.receive_json()
    assert resp["success"] and resp["result"]["rev"] == 1

    # stale expected_rev must be rejected with `conflict`
    await client.send_json_auto_id({"type": "houseplan/config/set", "config": cfg, "expected_rev": 0})
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "conflict"

    await client.send_json_auto_id({"type": "houseplan/config/get"})
    resp = await client.receive_json()
    assert resp["result"]["rev"] == 1


async def test_not_ready_without_entry(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    """WS commands answer not_ready when the integration has no loaded entry."""
    # register only the WS commands, without an entry
    from custom_components.houseplan import websocket_api as hp_ws

    hp_ws.async_register(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "not_ready"


async def test_plan_set_validates(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "../evil", "ext": "png", "data": "aGk="}
    )
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "invalid_space_id"

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "s1", "ext": "png", "data": "%%%not-base64%%%"}
    )
    resp = await client.receive_json()
    assert not resp["success"] and resp["error"]["code"] == "invalid_data"

    await client.send_json_auto_id(
        {"type": "houseplan/plan/set", "space_id": "s1", "ext": "png", "data": "aGVsbG8="}
    )
    resp = await client.receive_json()
    url = resp["result"]["url"]
    assert resp["success"]
    # versioned name: "<space>.<token>.<ext>" (review R2-1)
    name = url.rsplit("/", 1)[-1]
    assert name.startswith("s1.") and name.endswith(".png") and len(name.split(".")) == 3


async def test_admin_check_fails_closed(hass, hass_ws_client):
    """audit B2/T4: with no config entry the policy is unknown — deny writes.

    This used to allow them: plan uploads slipped through during a reload.
    """
    from custom_components.houseplan import websocket_api as wsapi

    class _User:
        is_admin = False

    class _Conn:
        user = _User()

    # no entry at all → non-admin must be refused
    assert wsapi._check_write(hass, _Conn()) is False

    class _Admin:
        is_admin = True

    class _AdminConn:
        user = _Admin()

    assert wsapi._check_write(hass, _AdminConn()) is True


async def test_files_migrate_copies_and_reports_mapping(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """review CR-2/CR-3: migrate COPIES, never overwrites, and reports the mapping."""
    import os

    from custom_components.houseplan.const import FILES_DIR

    await _setup(hass)
    client = await hass_ws_client(hass)

    base = hass.config.path(FILES_DIR)
    src = os.path.join(base, "old1")
    dst = os.path.join(base, "new1")

    def _prepare() -> None:
        os.makedirs(src, exist_ok=True)
        os.makedirs(dst, exist_ok=True)
        with open(os.path.join(src, "m.pdf"), "wb") as fh:
            fh.write(b"SOURCE")
        # a DIFFERENT file already owns the name in the destination
        with open(os.path.join(dst, "m.pdf"), "wb") as fh:
            fh.write(b"OTHER")

    await hass.async_add_executor_job(_prepare)

    await client.send_json_auto_id(
        {"type": "houseplan/files/migrate", "from_id": "old1", "to_id": "new1"}
    )
    resp = await client.receive_json()
    assert resp["success"], resp
    mapping = resp["result"]["mapping"]
    assert mapping["m.pdf"] != "m.pdf"  # renamed instead of overwriting

    def _read_all() -> tuple[bool, bytes, bytes]:
        with open(os.path.join(dst, "m.pdf"), "rb") as fh:
            other = fh.read()
        with open(os.path.join(dst, mapping["m.pdf"]), "rb") as fh:
            copied = fh.read()
        return os.path.isfile(os.path.join(src, "m.pdf")), other, copied

    src_kept, other, copied = await hass.async_add_executor_job(_read_all)
    assert src_kept, "migrate must COPY, not move (review CR-2)"
    assert other == b"OTHER" and copied == b"SOURCE"

    # cleanup runs only after the config is safely committed
    await client.send_json_auto_id({"type": "houseplan/files/cleanup", "marker_id": "old1"})
    resp2 = await client.receive_json()
    assert resp2["success"] and resp2["result"]["removed"] is True
    assert not await hass.async_add_executor_job(lambda: os.path.isdir(src))


async def _cfg(spaces: list[dict]) -> dict:
    """Minimal accepted configuration with the given spaces."""
    return {
        "spaces": [
            {"id": sp["id"], "title": sp["id"], "plan_url": sp.get("plan_url"),
             "aspect": 1.4, "view_box": [0, 0, 1, 1], "rooms": []}
            for sp in spaces
        ],
        "markers": [],
    }


async def _save(client, config, expected_rev):
    await client.send_json_auto_id(
        {"type": "houseplan/config/set", "config": config, "expected_rev": expected_rev}
    )
    return await client.receive_json()


async def _upload(client, space_id, data=b"x", ext="png"):
    import base64 as _b64

    await client.send_json_auto_id({
        "type": "houseplan/plan/set", "space_id": space_id, "ext": ext,
        "data": _b64.b64encode(data).decode(),
    })
    resp = await client.receive_json()
    return resp["result"]["url"], resp["result"]["url"].rsplit("/", 1)[-1]


async def test_plan_upload_does_not_touch_the_previous_file(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """review R2-1: a rejected config write must leave the stored plan intact.

    The upload used to overwrite "<space>.<ext>" (and unlink the other
    extension) BEFORE the revision-checked config write, so a conflict left the
    live plan replaced — or, with a new extension, pointing at a deleted file.
    """
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR

    await _setup(hass)
    client = await hass_ws_client(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    for stale in plans.glob("s9.*"):
        stale.unlink()
    legacy = plans / "s9.svg"  # what an older version stored, still referenced
    legacy.write_bytes(b"<svg>old</svg>")

    url0 = "/api/houseplan/content/plans/_/s9.svg"
    resp = await _save(client, await _cfg([{"id": "s9", "plan_url": url0}]), 0)
    rev = resp["result"]["rev"]
    assert legacy.is_file()

    url1, first = await _upload(client, "s9", b"hello")
    # config write rejected (stale revision): nothing on disk may change
    bad = await _save(client, await _cfg([{"id": "s9", "plan_url": url1}]), rev - 1)
    assert not bad["success"] and bad["error"]["code"] == "conflict"
    assert legacy.read_bytes() == b"<svg>old</svg>"
    assert (plans / first).read_bytes() == b"hello"

    # a second attempt neither overwrites the first nor the legacy file
    url2, second = await _upload(client, "s9", b"world")
    assert second != first
    assert (plans / first).read_bytes() == b"hello"
    assert legacy.is_file()

    # config accepted → the superseded file goes, the referenced one stays.
    # `first` is a rejected upload: it is young, so it is kept for now.
    ok = await _save(client, await _cfg([{"id": "s9", "plan_url": url2}]), rev)
    assert ok["success"]
    assert (plans / second).read_bytes() == b"world"
    assert not legacy.exists(), "the superseded plan is collected"
    assert (plans / first).is_file(), "a fresh unreferenced upload is NOT collected"


async def test_late_commit_of_one_client_never_deletes_another_client_s_plan(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """review R3-1: collection belongs to the commit, not to a client's request.

    With the previous `plan/cleanup(keep=...)` command, this interleaving left
    the accepted configuration pointing at a file that had just been deleted:

        A: upload PA, config/set(PA) accepted
        B: upload PB, config/set(PB) accepted
        A: cleanup(keep=PA)  ->  removes PB

    Collection now runs inside config/set under the write lock, so a late
    client cannot express an opinion about a revision it never saw.
    """
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR

    await _setup(hass)
    a = await hass_ws_client(hass)
    b = await hass_ws_client(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    for stale in plans.glob("r1.*"):
        stale.unlink()

    url0, p0 = await _upload(a, "r1", b"zero")
    rev = (await _save(a, await _cfg([{"id": "r1", "plan_url": url0}]), 0))["result"]["rev"]

    url_a, pa = await _upload(a, "r1", b"aaa")
    rev_a = (await _save(a, await _cfg([{"id": "r1", "plan_url": url_a}]), rev))["result"]["rev"]
    assert not (plans / p0).exists(), "P0 was superseded by A"

    url_b, pb = await _upload(b, "r1", b"bbb")
    ok = await _save(b, await _cfg([{"id": "r1", "plan_url": url_b}]), rev_a)
    assert ok["success"]

    # the accepted configuration points at PB, and PB is on disk
    assert (plans / pb).read_bytes() == b"bbb"
    assert not (plans / pa).exists(), "PA was superseded by B's commit"


async def test_commit_does_not_collect_another_client_s_uncommitted_upload(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """review R3-1, second interleaving: B uploads, A commits, then B commits.

    A's commit must not remove PB — B has not written its configuration yet, so
    PB is unreferenced but belongs to a live transaction. Age is the guard.
    """
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR

    await _setup(hass)
    a = await hass_ws_client(hass)
    b = await hass_ws_client(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    for stale in plans.glob("r2.*"):
        stale.unlink()

    url0, _p0 = await _upload(a, "r2", b"zero")
    rev = (await _save(a, await _cfg([{"id": "r2", "plan_url": url0}]), 0))["result"]["rev"]

    _url_b, pb = await _upload(b, "r2", b"bbb")     # B uploads, does not commit
    url_a, pa = await _upload(a, "r2", b"aaa")
    rev_a = (await _save(a, await _cfg([{"id": "r2", "plan_url": url_a}]), rev))["result"]["rev"]
    assert (plans / pb).is_file(), "an uncommitted upload survives someone else's commit"

    # B now commits on top of A's revision — its file is still there
    ok = await _save(b, await _cfg([{"id": "r2", "plan_url": "/api/houseplan/content/plans/_/" + pb}]), rev_a)
    assert ok["success"]
    assert (plans / pb).read_bytes() == b"bbb"
    assert not (plans / pa).exists()


async def test_abandoned_uploads_are_collected_once_old(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A rejected upload must not accumulate forever — but only age may free it."""
    import os
    import time
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR, PLAN_ORPHAN_TTL_S

    await _setup(hass)
    client = await hass_ws_client(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    for stale in plans.glob("r3.*"):
        stale.unlink()

    url0, p0 = await _upload(client, "r3", b"zero")
    rev = (await _save(client, await _cfg([{"id": "r3", "plan_url": url0}]), 0))["result"]["rev"]

    _url, orphan = await _upload(client, "r3", b"abandoned")
    old = time.time() - PLAN_ORPHAN_TTL_S - 60
    os.utime(plans / orphan, (old, old))

    ok = await _save(client, await _cfg([{"id": "r3", "plan_url": url0}]), rev)
    assert ok["success"]
    assert not (plans / orphan).exists(), "an aged, unreferenced upload is collected"
    assert (plans / p0).is_file(), "the referenced plan is never touched"


async def test_collection_ignores_files_that_are_not_plans(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The plans directory may hold nothing else, but be sure we only take ours."""
    import os
    import time
    from pathlib import Path

    from custom_components.houseplan.const import PLANS_DIR, PLAN_ORPHAN_TTL_S

    await _setup(hass)
    client = await hass_ws_client(hass)
    plans = Path(hass.config.path(PLANS_DIR))
    plans.mkdir(parents=True, exist_ok=True)
    old = time.time() - PLAN_ORPHAN_TTL_S - 60
    for name in ("notes.txt", "deep.name.with.dots.png", "readme"):
        (plans / name).write_bytes(b"x")
        os.utime(plans / name, (old, old))

    rev = (await _save(client, await _cfg([{"id": "r4", "plan_url": None}]), 0))["result"]["rev"]
    assert rev
    assert (plans / "notes.txt").is_file()
    assert (plans / "deep.name.with.dots.png").is_file()
    assert (plans / "readme").is_file()


async def test_a_marker_showing_its_value_can_be_saved(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """issue #3: display='value' was rejected, and one bad marker fails the lot.

    A user could not save the configuration at all after setting any sensor to
    "value instead of an icon" — the editor offered the option, the schema had
    never heard of it.
    """
    await _setup(hass)
    client = await hass_ws_client(hass)

    cfg = await _cfg([{"id": "f1", "plan_url": None}])
    cfg["markers"] = [
        {"id": "sensor.t", "binding": "entity:sensor.t", "display": "value"},
        {"id": "sensor.h", "binding": "entity:sensor.h", "display": "badge"},
    ]
    ok = await _save(client, cfg, 0)
    assert ok["success"], ok.get("error")

    await client.send_json_auto_id({"type": "houseplan/config/get"})
    got = await client.receive_json()
    assert [m["display"] for m in got["result"]["config"]["markers"]] == ["value", "badge"]


async def test_a_failing_collector_does_not_undo_an_accepted_save(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, monkeypatch
) -> None:
    """review R4-1: garbage collection runs behind an already durable write.

    If it raised, the client got an error for a revision the store had already
    accepted — and its retry then failed with `conflict`, because the server had
    moved on. The commit stands and the event fires regardless.
    """
    from custom_components.houseplan import websocket_api as wsapi

    await _setup(hass)
    client = await hass_ws_client(hass)

    events = []
    hass.bus.async_listen("houseplan_config_updated", lambda ev: events.append(ev.data))

    def _boom(*_a, **_k):
        raise OSError("the plans directory is on fire")

    monkeypatch.setattr(wsapi, "collect_plans", _boom)

    cfg = await _cfg([{"id": "r5", "plan_url": None}])
    ok = await _save(client, cfg, 0)
    assert ok["success"], "an accepted revision must be reported as accepted"
    rev = ok["result"]["rev"]

    await hass.async_block_till_done()
    assert events and events[-1]["rev"] == rev, "the update event still fires"

    # the store really holds the new revision, and the reported rev is usable
    await client.send_json_auto_id({"type": "houseplan/config/get"})
    got = await client.receive_json()
    assert got["result"]["rev"] == rev
    assert [sp["id"] for sp in got["result"]["config"]["spaces"]] == ["r5"]

    monkeypatch.undo()
    again = await _save(client, cfg, rev)
    assert again["success"], "the next CAS on the reported revision goes through"


async def test_content_signed_path_opens_without_a_bearer_header(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, hass_client_no_auth
) -> None:
    """B1 follow-up: a browser <image>/<a> sends no Authorization header.

    The unsigned url must be refused and the signed one must work — otherwise
    plan backgrounds and PDF links 401 on a real dashboard (reproduced live,
    2026-07-27).
    """
    import os

    from custom_components.houseplan.const import CONTENT_URL, PLANS_DIR

    await _setup(hass)
    plans = hass.config.path(PLANS_DIR)

    def _write() -> None:
        os.makedirs(plans, exist_ok=True)
        with open(os.path.join(plans, "s1.png"), "wb") as fh:
            fh.write(b"PNGDATA")

    await hass.async_add_executor_job(_write)
    path = f"{CONTENT_URL}/plans/_/s1.png"

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/content/sign", "paths": [path]})
    resp = await client.receive_json()
    assert resp["success"], resp
    signed = resp["result"]["urls"][path]
    assert "authSig=" in signed

    http = await hass_client_no_auth()
    assert (await http.get(path)).status == 401          # unsigned: refused
    ok = await http.get(signed)
    assert ok.status == 200 and await ok.read() == b"PNGDATA"

    # only our own endpoint may be signed
    await client.send_json_auto_id(
        {"type": "houseplan/content/sign", "paths": ["/api/other/secret"]}
    )
    resp2 = await client.receive_json()
    assert resp2["success"] and resp2["result"]["urls"] == {}


async def test_signing_one_path_may_fail_without_failing_the_request(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, monkeypatch
) -> None:
    """review R5-1: pin the contract the card now codes against.

    One unsignable path must NOT fail the whole call — a single bad url would
    otherwise block the signatures of every other file in the batch. The answer
    is a partial map, and the card treats a path missing from it as a failure
    for that path (backing off) rather than as success.
    """
    from custom_components.houseplan import websocket_api as wsapi
    from custom_components.houseplan.const import CONTENT_URL

    await _setup(hass)
    good = f"{CONTENT_URL}/plans/_/good.png"
    bad = f"{CONTENT_URL}/plans/_/bad.png"

    real = wsapi.async_sign_path if hasattr(wsapi, "async_sign_path") else None
    assert real is None  # imported inside the handler, so patch the source module

    import homeassistant.components.http.auth as ha_auth

    original = ha_auth.async_sign_path

    def _sign(hass_, *args, **kwargs):
        path = next((a for a in args if isinstance(a, str) and a.startswith("/")), "")
        if path == bad:
            raise ValueError("cannot sign this one")
        return original(hass_, *args, **kwargs)

    monkeypatch.setattr(ha_auth, "async_sign_path", _sign)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "houseplan/content/sign", "paths": [good, bad]})
    resp = await client.receive_json()
    assert resp["success"], "one bad path must not fail the batch"
    urls = resp["result"]["urls"]
    assert good in urls and "authSig=" in urls[good]
    assert bad not in urls, "an unsignable path is absent, never an unsigned url"


async def test_config_write_is_capped_by_total_size(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """HP-1454-05: per-field limits bound each list, this bounds their product."""
    from custom_components.houseplan.validation import MAX_CONFIG_BYTES, MAX_TEXT

    await _setup(hass)
    client = await hass_ws_client(hass)
    cfg = await _cfg([{"id": "f1", "plan_url": None}])
    # every field inside the caps, the whole thing far past them
    blob = "d" * MAX_TEXT
    cfg["settings"] = {"known_devices": [blob] * (MAX_CONFIG_BYTES // MAX_TEXT + 100)}
    resp = await _save(client, cfg, 0)
    assert not resp["success"] and resp["error"]["code"] == "too_large"

    cfg["settings"] = {"known_devices": ["ok"]}
    assert (await _save(client, cfg, 0))["success"]


async def test_layout_keeps_its_revision_and_announces_changes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """HP-1454-08: point-wise writes used to drop the revision and say nothing.

    layout/set offered optimistic locking, but every drag wrote {"layout": …}
    and reset the counter to 0, so the lock protected nothing; and a static card
    on the same dashboard never learned that a marker had moved.
    """
    await _setup(hass)
    client = await hass_ws_client(hass)
    events: list[dict] = []
    hass.bus.async_listen("houseplan_layout_updated", lambda ev: events.append(ev.data))

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    assert (await client.receive_json())["result"]["rev"] == 0

    await client.send_json_auto_id(
        {"type": "houseplan/layout/set", "layout": {"a": {"x": 1, "y": 2}}, "expected_rev": 0}
    )
    rev = (await client.receive_json())["result"]["rev"]
    assert rev == 1

    await client.send_json_auto_id(
        {"type": "houseplan/layout/update", "device_id": "b", "pos": {"x": 3, "y": 4}}
    )
    assert (await client.receive_json())["result"]["rev"] == 2

    await client.send_json_auto_id({"type": "houseplan/layout/delete", "device_id": "b"})
    assert (await client.receive_json())["result"]["rev"] == 3

    await client.send_json_auto_id({"type": "houseplan/layout/get"})
    got = await client.receive_json()
    assert got["result"]["rev"] == 3 and got["result"]["layout"] == {"a": {"x": 1, "y": 2}}

    # a stale wholesale write is refused, which it could not be before
    await client.send_json_auto_id(
        {"type": "houseplan/layout/set", "layout": {}, "expected_rev": 1}
    )
    bad = await client.receive_json()
    assert not bad["success"] and bad["error"]["code"] == "conflict"

    await hass.async_block_till_done()
    assert [e["rev"] for e in events] == [1, 2, 3]


async def test_uploaded_svg_is_sandboxed_and_a_pdf_is_not(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, hass_client
) -> None:
    """HP-1454-01: user SVG served from HA's origin must not be a live document.

    Only SVG gets the header: a CSP on a PDF response can break the browser's
    built-in viewer, and a raster image cannot execute anything anyway.
    """
    import os

    from custom_components.houseplan.const import CONTENT_URL, FILES_DIR, PLANS_DIR

    await _setup(hass)
    plans = hass.config.path(PLANS_DIR)
    files = os.path.join(hass.config.path(FILES_DIR), "m1")

    def _write() -> None:
        os.makedirs(plans, exist_ok=True)
        os.makedirs(files, exist_ok=True)
        with open(os.path.join(plans, "x.svg"), "wb") as fh:
            fh.write(b"<svg xmlns='http://www.w3.org/2000/svg'/>")
        with open(os.path.join(plans, "x.png"), "wb") as fh:
            fh.write(b"PNG")
        with open(os.path.join(files, "m.pdf"), "wb") as fh:
            fh.write(b"%PDF-1.4")

    await hass.async_add_executor_job(_write)
    http = await hass_client()

    svg = await http.get(f"{CONTENT_URL}/plans/_/x.svg")
    assert svg.status == 200
    csp = svg.headers.get("Content-Security-Policy", "")
    assert "sandbox" in csp and "script-src 'none'" in csp
    assert svg.headers["Content-Type"].startswith("image/svg+xml")

    png = await http.get(f"{CONTENT_URL}/plans/_/x.png")
    assert png.status == 200 and "Content-Security-Policy" not in png.headers

    pdf = await http.get(f"{CONTENT_URL}/files/m1/m.pdf")
    assert pdf.status == 200 and "Content-Security-Policy" not in pdf.headers
    assert await pdf.read() == b"%PDF-1.4"


async def test_upload_never_overwrites_an_existing_attachment(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, hass_client
) -> None:
    """HP-1454-02: an upload is not part of the config transaction.

    Writing straight to `<marker>/<filename>` meant a cancelled dialog — or a
    rejected save — left the stored url serving the new bytes. And two new
    markers both uploading `manual.pdf` shared one physical file.
    """
    import os

    from custom_components.houseplan.const import CONTENT_URL, FILES_DIR

    await _setup(hass)
    http = await hass_client()

    async def upload(marker_id: str, name: str, data: bytes) -> str:
        import aiohttp

        writer = aiohttp.FormData()
        writer.add_field("marker_id", marker_id)
        writer.add_field("file", data, filename=name)
        resp = await http.post("/api/houseplan/upload", data=writer)
        assert resp.status == 200, await resp.text()
        return (await resp.json())["url"]

    first = await upload("m9", "manual.pdf", b"ONE")
    second = await upload("m9", "manual.pdf", b"TWO")
    assert first != second, "the second upload must not take the first name"

    folder = os.path.join(hass.config.path(FILES_DIR), "m9")
    # the HA test config dir is shared across the module — hence our own marker id
    names = sorted(
        n for n in await hass.async_add_executor_job(os.listdir, folder) if n.startswith("manual")
    )
    assert names == ["manual (2).pdf", "manual.pdf"]

    got = await http.get(first.replace(CONTENT_URL, CONTENT_URL))
    assert await got.read() == b"ONE", "the first file is untouched"
    got2 = await http.get(second)
    assert await got2.read() == b"TWO"
