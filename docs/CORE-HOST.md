# Shared plan command host

`houseplan-core` provides `houseplan_core.plan_commands.PlanCommands`. The HA
integration imports the identical source under `custom_components.houseplan.core`;
it does not download a separate package at runtime. Python 3.14+, voluptuous and
Pillow are required. Ordinary stable releases supply a checked wheel alongside
the standalone editor; see [Standalone frontend](STANDALONE-FRONTEND.md#consume-an-ordinary-stable-release).

## Compatibility and versioning

The wheel keeps the product version. Ordinary stable `1.86.1` is wheel
`1.86.1`; prereleases use the equivalent PEP 440 spelling (for example
`2.0.0-beta.2` becomes `2.0.0b2`), with the original product spelling retained
in `distribution.json`. There is no independent core release counter.
A breaking change to the public core contract requires a product major release.

The public core contract consists of `PlanCommands` and its documented binary
entry points, the request/reply and failure semantics they expose, the host
protocols/types in `command_ports.py`, and the documented portable document
and archive readers/writers, including `PLAN_MODEL_VERSION`. Other importable
helpers are implementation details unless explicitly documented as host APIs.
New optional capabilities can be additive; a host advertises them only when
implemented. A passing old version string never substitutes for a required API.

There are two distinct compatibility checks:

- **Running one editor:** pin wheel/core adapter and standalone frontend from
  the same product release and source commit. The existing exact product
  version, real frontend fingerprint and required-API handshake remains
  mandatory, including after reconnect. Mixing a newer SDK with an older core
  is unsupported even within one minor line. HA embeds the same canonical
  core, rather than installing the wheel at runtime.
- **Transferring data between installations:** HA and an external site may
  update independently. The destination validates the archive container,
  embedded document/export version, model version and all declared required
  APIs. Product major/minor equality alone neither accepts nor rejects a file.
  A later stable in the same major must preserve reading previously supported
  stable documents through explicit readers/migrations and frozen producer
  fixtures. Removing that backward support is a breaking product major change.
  Cross-major support is only what is explicitly documented and tested.

The current reader contract is:

| Container | Container version | Embedded document | Model acceptance |
|---|---|---|---|
| `houseplan-plan-transfer` (whole-house plan-only ZIP) | `archive_version: 1` and canonical mimetype v1 | `houseplan-export`, `kind: house`, `export_version: 4`; `house_transfer_api: 1` plus any per-file requirements | Exactly model 11 today; older models need an explicit house migration before they can be promised. |
| `houseplan-full-backup` (HA installation ZIP) | `version: 1` | `houseplan-export`, `kind: full`; export versions 1–5 accepted subject to extension validation | Nonnegative models through 11, through the existing JSON validation/migration path. |
| Portable space/full JSON | No ZIP container | `houseplan-export`, `kind: space/full`; export versions 1–5 accepted subject to extension validation | Nonnegative models through 11, through the existing JSON validation/migration path. |

Container schema, document export version and plan model version are independent
counters. Increasing one does not by itself require a major release if old
supported data remains readable; losing that support does. A new writer's
higher model/export/API is not promised readable by an older installation.
There is no downgrade or arbitrary future-model guarantee. Unsupported files
are refused before applying state; a host must not relabel a future file as
an older model to force acceptance. Normal validation, repair confirmation,
resource bounds and authorization still apply to historical data. Full-backup
reading in a conformance test does not grant PLAN_ONLY full-backup operations.

The current 2.x core explicitly retains both ZIP kinds produced by stable
1.86.0 and 1.86.1 (model 11, house export 4, full export 3), despite that major
boundary. `demo/fixtures/core-compatibility/` contains real synthetic output
from each pinned stable commit, provenance and hashes. They cover two floors,
stairs between them, image content, labels and the full-backup marker boundary.
The installed wheel/sdist ships those exact bytes; the default
`python -m houseplan_core.conformance` also runs `run_archives()` on them.
This proves historical archive decoding/projection, not HA restore durability
or a deployed site's database. Continue to run host and HA restore tests for
those separate guarantees.

To extend support, retain the previous stable fixtures and add producer
fixtures before changing readers. To reproduce the initial set, fetch the
two tags and run `python tools/generate_core_compatibility_fixtures.py --out
/path/to/fresh-directory`; the generator extracts pinned tag sources and uses
their real exporters and readers with synthetic inputs and a fixed clock.
Compare the resulting archives and provenance byte-for-byte. Never regenerate
old fixtures with the current exporter.

Ordinary stable publication rereads the checked wheel's METADATA and
`distribution.json`, the HACS ZIP's `manifest.json`, and the standalone
ZIP's manifest. Their versions must match the candidate (with PEP 440
normalization performed at package build); source fingerprint/commit must
also match. A mismatch fails before release creation/upload, even if asset
hashes and filenames were updated. Release notes link to this contract at
the pinned source commit.

## Trust boundary

Use `PlanCommands.execute` for structured requests and the documented binary
entry points: `upload_plan`, `upload_asset`, `import_preview`, `house_preview`,
`stage_structural` and `resolve_structural`. Bind typed ports from
`command_ports.py` to the authenticated principal and the authorized plan
scope. A browser supplies input, not permission. A token is not a grant to
another plan or user; never accept a storage root, tenant identity, or resource
policy supplied by a client. An external editor uses `PLAN_ONLY` and the strict
input profile, and must enforce its own authentication and authorization.

Other importable modules include validators, migrations, geometry and
filesystem helpers. They are not stable transport endpoints or a sandbox:
callers pass only normalized data and host-owned paths. Trusted integrations
that call pure input helpers directly must explicitly bound the entire
preparation with `input_scope(STRICT_INPUT_POLICY)` where applicable; a relaxed
policy is a trusted-host decision. Do not put a durable `PlanCommands` operation
inside that scope: the facade closes its own budget before publishing.

The host owns account/tenant isolation, request framing, concurrent and total
resource limits, CPU execution, storage locking, recovery and durability.
The reference host and JSON-client adapter illustrate these contracts and
`houseplan_core.conformance` checks them without HA. Passing conformance
does not certify a production host or its filesystem. See the
[backend/core audit](security/1605-backend-core-audit.md) for the HA boundary.

## Ports and ownership

### Optional whole-house transfer (#1464)

Configure `CommandEnvironment.house` to advertise `house_transfer_api: 1` in
config/get. It is optional and does not enlarge the standalone base handshake.
The shared command layer owns `kind: house, plan_only: true`, preview, scoped
identity maps, revalidation, revision CAS and the additive paired commit. It
never invokes the single-space importer repeatedly or grants full-backup access.

`HouseResources` supplies one owner/scope-bound import/export lease, private
stream staging, verified image reads/destination preparation and a data-only
file descriptor for the storage journal. A lease exposes token, expiry, record
and pinned state; records remain private, not exported configuration. A host
can store those records and blobs transactionally in its own repository. It
need not use HA directories, an HTTP route, Zigbee or the reference filesystem.
`FilesystemHouseResources` is a single-process adapter using the existing
content lock. Like `ReferencePlanHost`, it is not a multi-process website DB.

Route only the canonical first stored `mimetype` record (at most 1 KiB) before
allocating the house operation. Upload has an explicit byte policy; start the
single preparation budget after the network body is staged, retain it through
ZIP decoding/projection/remapping and close it before publishing the preview or
committing the stores. Never wrap a durable command with a late strict deadline.
Cancellation/expiry must settle workers before removing the positively-owned
stage. The private house pool is distinct from installation-backup slots.

The host's paired writer must retain a typed `house_import` target/rollback
intent with the file descriptor. Promote only verified complete files before
publishing their config references; reuse requires matching bytes/identity.
Preserve the existing target config/layout exactly, including unresolved refs
and unknown metadata; invalidate the old optimizer snapshot, without global
import Undo. Recover the pending unit before any following revision comparison.
Pin its private archive/inode proofs until the two stores and rollback policy
are durable. Do not route it through full-backup/Zigbee recovery or downgrade
while it remains pending. Missing ownership proof never authorizes file removal.

The separately callable `conformance.run_house(factory, root)` extension adds
house_preview and download_house to the adapter fixture. The wheel and sdist
smoke installs execute it with both example factories without importing HA.

The contracts are in `command_ports.py`. Construct a request-scoped command
service with storage, CPU execution, current write authority, after-commit
effects and a `CommandEnvironment`. The environment selects `CommandPolicy.HA`
or `PLAN_ONLY` independently of the input-resource policy. External sites use
`PLAN_ONLY` and the strict input profile, not HA permissions or service routes.

The storage transaction loads one coherent revision pair **after recovery**.
It serializes state/content writers, or repeats both revision comparisons in
the actual durable commit with equivalent content/pin constraints. A process
lock alone is insufficient for a multi-process service. A successful write
must be durable before it returns; a pair failure restores the old pair or
keeps a recoverable intent and reports `PairCommitFailure`. Preserve unknown
store metadata, migration sources, backups and exact revision rules. `load`
reports `recovered_kind` so the shared layer emits the existing two events.
Revision-bound validation caches are optional and never replace CAS.

The content port works with logical keys and immutable integrity metadata,
not HA paths. It provides bounded catalogs, staged upload contexts, atomic
promotion, explicit deletion and post-commit `ContentRetirement` intents.
The common layer decides what is superseded; the adapter never infers that
unreferenced plans or deleted-space files can be aged out. Respect transaction
lock order: state then content; uploads acquire only content. No partial files
or sidecars become public, quota includes orphan blobs, and cancellation must
settle workers before releasing the content transaction. A content-addressed
blob without a sidecar is repairable on identical upload without new quota.

Import previews are owner/scope/expiry/digest-bound, bounded and conditionally
updated; do not resurrect evicted leases. Consume an import preview only after
the durable commit. Structural staging uses `StructuralUploads` inside a
scope-bound repository transaction; persist its records (including stable
identity/revision) under your real shared lock. Only immutable snapshots cross
awaits. It is temporary, not an import or an authorization capability. Reject
foreign owners, expired, consumed, purpose/control/hash-mismatched tokens.
The HA dictionary adapters and `ReferencePlanHost` are single-loop ephemeral
examples, **not durable or multi-process storage**.

`CpuExecutor.run` must propagate contextvars and keep CPU work off the event
loop. `PlanCommands` owns its preparation budget: wall time begins after the
initial state read/lock, includes preparation I/O and CPU, and is checkpointed
and closed **before** durable publication. Do not wrap a durable command in
an external `input_scope`; a late timeout must not reject committed success.
Authority must be checked on the host loop against the live principal/scope,
not inferred from a token. Publication ports recheck after their own awaits.
Effects/cleanup after durable writes are best effort and cannot roll back the
accepted pair or report false failure. Do not emit events for half a pair.

## Operations

`execute` accepts the existing plan-only command payloads: config/layout get
and set, space/delete, wall/node_move (including merge/attach intents) and
node_delete, geometry/repair dry/apply/undo, plan/optimize and optimize_undo,
plans list/delete, assets list/resolve/delete, space JSON export/import
revalidate/apply and the legacy backup/cancel branch. Binary transport methods
are `upload_plan`, `upload_asset`, `import_preview`, `stage_structural` and
`resolve_structural`. Transport framing/schemas stay in the host; domain and
transaction decisions do not. Config no-op still checks CAS; explicit null
room labels delete saved positions; hidden LED/HA fields remain preserved.

PLAN_ONLY denies full JSON/archive/migration-source operations before lease
creation; HA still uses common space/full JSON commands. Specialized archive
and migration-source workflows remain HA-only. Legacy JSON `backup/cancel`
requires archive-admin and returns an admin no-op without deleting the portable
preview (writer: unauthorized). Its old behavior is intentionally retained;
new whole-house transfer cancellation is a separate #1464 contract. Device,
Zigbee, entity management and full installation-backup endpoints are not exposed
by this library. No web server, accounts, deployment or production tenant DB
is bundled.

### Room label position patch (#1563)

With `CommandPolicy.PLAN_ONLY`, `config/get` advertises
`room_label_layout_patch_api: 1`. Hosts forward the following mutually
exclusive form of the existing `layout/set` route to the shared core:

```json
{
  "type": "houseplan/layout/set",
  "room_label": {
    "room_id": "living", "space_id": "ground",
    "before": {"s": "ground", "x": 0.3, "y": 0.2, "k": 1.2},
    "position": {"s": "ground", "x": 0.425, "y": 0.2625, "k": 1.2}
  }
}
```

Use `before: null` only for an absent entry. Tests and hosts must distinguish
missing `s`/`k` in a previously stored position from an explicitly set value.
Core compares the canonical coordinate and label fields for this room under
the transaction, checks current room ownership and live write authority, and
preserves every other layout entry and any extra fields of this entry.
`position.s` must match the owning space, and optional `k` must be 0.5–3.
A stale `before` returns `conflict` even when the proposed position is now in
storage. On success the durable reply is
`{ok:true,rev,room_label:{room_id,space_id,position}}`; a no-op retains the
revision. Real changes keep the usual `layout/set` invalidation of obsolete
Undo snapshots and emit one `houseplan_layout_updated` after the commit.
The host must not return or synthesize a successful receipt before durable
commit. The HA route and full-layout form are unchanged.

## Build and install

In an author/build environment install `build packaging setuptools wheel`,
then run `python tools/build_core_package.py --out artifacts/core`. The tool
stages the same canonical `.py` files under `houseplan_core` and builds both
wheel and sdist without importing HA or rewriting frontend snapshots.
`pip install artifacts/core/houseplan_core-*.whl` installs the library. Build a
wheel from the sdist with `pip wheel --no-deps houseplan_core-*.tar.gz`.
`distribution.json` records original product version, PEP440 version and exact
source SHA256 manifest. No frontend fingerprint is invented by the package;
the host supplies the actual matching frontend build identity.

The reference assembly is `ReferencePlanHost(config, fingerprint, version,
root)`. Use `await host.request(payload)` and its `commands` binary methods.
Its bootstrap normalizes a synthetic fixture only; a real host must load and
recover its persisted state, not normalize an existing house as a new fixture.
Run the reusable conformance suite with your adapter factory as documented
below. Passing reference tests is not proof of your database durability.

## Adapter conformance

After installation run `python -m houseplan_core.conformance`. To exercise the
same scenarios through a second factory:
`python -m houseplan_core.conformance --factory houseplan_core.conformance_example:JsonClientAdapter`.
This example adds a JSON client boundary; it still uses reference persistence
and is explicitly not proof of database durability. Replace its `_call` with
your authenticated test-service client and local fault controller. Never add
public reset/fault endpoints to the deployed service.

A factory receives an isolated temporary `Path` and returns an adapter (sync
or async). Its async methods are `reset(seed)`, `request(command)`,
`preview(raw_bytes)`, `stage(raw_bytes)`, `upload_plan(raw, space, extension)`,
`upload_asset(raw, name)`, `snapshot()`, `revoke_next_preparation()` and
`fail_next_pair()`. Snapshot contains `config_data`, `layout_data` and ordered
`events` as `(name, payload)` tuples. Reset clears only the synthetic tenant.
The hooks simulate loss of current authorization after preparation and one
rolled-back pair-write failure; they must affect actual adapter writes.
Run with `--factory your_test_module:create_adapter` from an environment able
to import that module. Assertions have independent revisions/content/event
expectations, not just a comparison of two calls to the same implementation.

The shipped suite covers no-op/CAS, events, null room labels, repair dry/apply/
undo, pair refusal, delete/Undo, revocation, additive space transfer, variant
denials, catalogs/deletion, deduplication and one-shot staged controls. The
repository additionally tests real HA parity for all four node operations,
Optimize/Undo, file ACL/quota/owner/expiry/cancellation and recovery. Extend
your adapter's own tests for crash recovery, multi-process transactions,
storage quotas and tenant isolation; this single-process suite cannot prove
those physical guarantees for an arbitrary database.
