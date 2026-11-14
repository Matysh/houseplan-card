# Isolated frontend distribution

`npm run build:standalone` builds the **real** House Plan renderer and editors
in `dist-standalone/`. This is a local developer distribution from current dev,
not a published website, production backend, installation backup format or new
stable release. Its source commit, dirty flag and content fingerprint are
explicit. A future stable pin needs a separate owner-authorized release that
actually contains #1391–1395, #1422 and #1423.

The installed HA build is still `npm run build`: it has its own `dist/` and
manifest. The standalone builder neither cleans nor writes that tree, the
tracked installed frontend, the owner's HA, or the personal UI Lab. Rebuilds
retire only hash-proven generated files from their own preceding manifest;
unowned/linked output is refused. Keep all files named by the standalone
manifest together, not just the facade JS.

## Embedding API

Provide a dedicated document and a real `PlanHost` implementation. A PlanHost
is not `hass`: it owns transport, storage, read/write authority, connection and
subscriptions. The implementation is defined in `src/plan-host.ts`. No public
server/storage adapter is supplied by this task.

```js
const { mountHouseplan, PLAN_ONLY_CAPABILITIES } =
  await import('./dist-standalone/houseplan-standalone.js');

// createMyHost is YOUR adapter, not an API supplied by this distribution.
const host = createMyHost({ capabilities: PLAN_ONLY_CAPABILITIES });
const mounted = mountHouseplan(document.querySelector('#plan'), host,
  { language: 'ru', darkMode: true });
try {
  await mounted.ready;
  // Handshake succeeded and the real component is connected. First paint and
  // lazy editor/locale readiness remain the product's ordinary lifecycle.
  mounted.updatePresentation({ language: 'de', darkMode: false });
} catch (error) {
  // The mount displays a localized connection/version/API notice, without
  // telling a standalone user to update HA/HACS. Retry with a fresh mount.
} finally {
  // Call on actual departure, not immediately after successful mounting.
  mounted.dispose();
}
```

Give the embedding container an explicit height. Importing the entry alone
does not register `houseplan-card`, its Lovelace picker metadata or HA banner.
Mounting explicitly installs the isolated presentation owner from
[STANDALONE-PRESENTATION](STANDALONE-PRESENTATION.md). A mixed HA document or
foreign card registration is refused; embedding alongside HA needs an iframe.
The real PlanHost is injected **before** DOM connection and before any default
HA adapter access. `card.hass` is never assigned.

One live mount owns one container. Different mounts may share the same source
host but have separate themes and subscriptions. `dispose()` immediately
revokes this mount's inputs/results, releases its own environment/event leases
(including pending subscriptions), disconnects its card/portals and restores its
theme-owned values. It does not dispose the supplied source host, delete saved
data or unregister document definitions. Always dispose a failed mount as well.
The returned `ready` Promise must be observed by the embedder.

## Required host contract

The host supplies a frozen `PLAN_ONLY_CAPABILITIES` profile, complete ports,
opaque `authorityKey`, monotone `writeAuthorityRevision` and
`environmentRevision`, and ready/connected/read/write/admin publications.
Replacement of identity or permissions revokes asynchronous writes; ordinary
presentation changes must not impersonate a new writer. The facade adds only
per-mount presentation/lifetime ownership, not a second storage model or auth.

| Port | Responsibility |
|---|---|
| `request` | Existing `houseplan/*` commands, authoritative acknowledgements, revisions/CAS and domain failures. |
| `subscribe` | `houseplan_config_updated` / `houseplan_layout_updated` events and idempotent release. |
| `subscribeEnvironment` | Notify connection/authority/permission/locale-environment changes; synchronous release. |
| `http.request` | Multipart image uploads and raw JSON import preview on existing `/api/houseplan/*` paths. |
| `http.postJson` | Structured staging on `/api/houseplan/structural/upload`; purpose is capability-checked before allocation. |
| `content.resolve` / `resolveAssets` | Resolve only explicit host-provided plan/decor content; no implicit HA signer or global token. |

`config/get` must return `config`, nonnegative integer `rev`, boolean
`can_write`, actual `integration_version` (the core/adapter's version), and
actual compatible `frontend_fingerprint`. The core/adapter version must match
this SDK's product version (the separate dev SHA/channel still distinguishes
unreleased code). Do not manufacture the current
fingerprint for an incompatible host. This build requires the APIs declared by
`STANDALONE_REQUIRED_APIS` in `src/standalone-plan-host.ts`: opening features,
graph change v2, plan graph, room-label layout, decor assets, node move/delete/
merge/attach. Merge and attach use the existing node-move intent route, not
invented endpoints. Missing/mismatched facts produce the standalone notice
before connecting a writable editor. Every later `config/get`, including after
reconnection, repeats that check. A changed build/API retires this mount and its
leases, removes the editor and shows the same localized host notice, never HA
restart advice. Dispose the handle and create a fresh compatible mount to retry;
the supplied source host and other mounts are not destroyed.

The manifest records portable core model/export compatibility independently
from the UI version. Model/export versions come from core constants; the
readable historical versions and minimum model are a tested snapshot of the
core parser's current acceptance rules, not inferred from a release number. The host must still validate
each persisted/imported document through that core. Frontend capability guards
are not server authorization and are not a substitute for CAS/ACL/validation.

## Persistence and transfer

All reads, saves, Optimize/Undo, assets and transfer use the existing ports and
capability guards. A painted draft is not a successful save. Ordinary Save and
remount preserve hidden HA markers/contact/lock data in authoritative storage;
the plan-only UI never displays or executes those device features.

Portable transfer is **single-space plan-only JSON**, not ZIP or full backup.
The core projection is authoritative: markers are empty, opening/leaf HA links
are cleared, live text is frozen, geometry/opening features/decor/columns/graph,
label positions and display settings are retained. LED geometry is unbound.
`target_space_id` is still present in the exported stairs projection; the
single-space **importer** clears cross-floor links. Import adds a new space with
new/remapped identities and a unique title, so round-trip comparison uses
content and ID mapping, not literal IDs or the original full house. Ordinary
HA/legacy space JSON may import hidden bindings under the existing core rules;
they remain stored but unavailable. Unsupported model/ZIP/full JSON must not
partially apply. This task does not introduce a new persisted format.

## Local assets and manifest

The package includes finite local SVG paths, all current en/ru/de/fr chunks,
actual local Roboto Regular 400 and its license. Weights 500/600 use normal
browser synthesis; if the font is unavailable, system-ui/sans-serif remains a
usable fallback. No HA frontend, wheel, private factory, MDI API or UI CDN is
downloaded. The builder checks the finite map before every standalone build.
Local user content is resolved separately by the supplied host.

`houseplan-standalone-manifest.json` enumerates every emitted file with raw and
gzip byte counts and SHA-256, module imports/dynamic imports, local font/CSS/
license paths, source identity and compatibility. References remain local and
relative. The emitted owner chunk, not an assumed facade directory, determines
the stylesheet URL. Existing editor/locale retry and source-fingerprint checks
are retained. Loss of the entry itself is an embedding-loader error: the
embedder must observe dynamic-import rejection and offer reconnect/reload;
an absent script cannot render its own UI. The SDK's visible connection notice
covers failed/incompatible host handshakes after it loads.

## Test-only reference transport

`demo/standalone/` is a synthetic contract laboratory, **not** a deployable
backend. `host.js` implements the browser ports. The browser test routes those
requests to `core-process.mjs` → an isolated Python stdio process
`core_process.py`. The process reuses the real pure core for config/graph/schema
validation, portable export/preview/apply, node proofs, structural staging and
image validation. It owns only an in-memory revision pair, temporary files,
preview tokens and one-deep Optimize intent. It does not prove production
durability, quotas, authentication, concurrency across processes or HA service
behavior. HA import is prohibited in that subprocess and asserted in snapshots.

This finite dispatcher is not a complete implementation of every allowed port
operation. In particular `space/delete`, `plans/delete` and `geometry/repair`
return `fixture_unsupported`; its `config/set` does not implement HA's complete
deletion-layout reconciliation, null room-label removal, LED preservation or
no-op revision semantics. It is evidence for the journeys enumerated below,
not a storage adapter to copy into production. Implement the complete allowed
command contract for a real host; the shared capability guard grants a feature,
not a promise that this test dispatcher implements all of its subcommands.

For the actual request fields and responses, see the
[WebSocket command table](ARCHITECTURE.md#integration-ws-api) and its handlers,
`src/plan-capabilities.ts` (`permitsCommand`/`permitsHttp`) and
`custom_components/houseplan/websocket_api.py`. Plan-only's base routes are
`config/get|set`, `layout/get|set`, `space/delete`, node move/delete (including
merge/attach intents), `export/create` with `kind: space, plan_only: true`,
`import/revalidate|apply`, `backup/cancel`, `plan/optimize|optimize_undo`,
`geometry/repair`, `plans/*` and `assets/*`. Existing HTTP routes are
`/api/houseplan/plans/upload`, `/assets/upload`, `/import/preview` and
`/structural/upload` under that same prefix. Installation-backup/marker/service
routes remain refused. Consult the owning handler rather than inventing fields
or returning acknowledgements without a validated, revisioned write.

The separate `tests_backend/test_ha_standalone_core_transport.py` compares the
dispatcher against authenticated real HA HTTP/WS/Stores on the same synthetic
inputs: Save/CAS, paired Optimize/Undo, all four node APIs and structural
staging/compact commit. This does not turn the reference transport into a
production server. The older echo fixture remains a fault/UI witness only;
node API flags are no longer asserted by default for operations it cannot run.

Use the pinned Node/browser and the ordinary backend-test Python environment
from [DEVELOPMENT](DEVELOPMENT.md). Activate it before the native/core tests;
`HP_STANDALONE_PYTHON` may name that interpreter explicitly. Missing Python/core
dependencies are failures, not silently skipped successes. No owner instance,
credentials, HA frontend wheel or Docker application is needed for the positive
autonomous journey. Existing release HA E2E retains its own purpose.

```text
node --test test/standalone-plan-host-boundary.test.mjs test/standalone-entry-manifest.test.mjs test/standalone-core-import-boundary.test.mjs
node demo/smoke_standalone_entry.mjs
python -m pytest tests_backend/test_ha_standalone_core_transport.py -q
```

Native evidence and candidate PNGs go to `artifacts/standalone-entry/`. They are
review material, not accepted baselines or a replacement for the owner's UI Lab.
Measurements report actual source/browser/viewport/cache/network conditions;
they are observations, not a new startup/size budget or the old #1393 shell
probe presented as the complete editor.
