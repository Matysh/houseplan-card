# #1290 — beta.5 validation compatibility

The completed beta run41910290952 tested d33a8e42c (version preparation over accepted
dev ff650ec58). It completed all34 steps, with failures in three Node groups,
backend and the newly extended first-run journey. All75 visual scenes passed.
This task changes test expectations and supporting proof, not product runtime.

## Authored lattice and cross-runtime targets

#1282 deliberately restores arithmetic noise below1e-4 lattice steps. A one-ULP
coordinate such as0.22500000000000003 is not a meaningful off-grid negative.
The native test retains that input as a positive lattice example and separately
uses genuine offsets0.22501/0.39585. The node-editor test keeps separate proof
of the microtarget, asserts canonical preview/write wire, and adds an outside-noise
negative. No stale-target/reproof safeguards are removed.

The shared current fixture changes five q points to the intended l points and
only their numeric projections. Raw historical optimize-storage-roundtrip.json
is unchanged; its SHA still anchors the current fixture. Both TS and Python
assert independent literal lattice sets, preservation of identity/metadata and
real off-grid coordinates; expected data is not an independent product oracle
merely because it has been regenerated.

## Wall passports

The separately retained semantic audit reproduces the575 original current
passports with the old659440571 engine before comparing accepted ff650ec58.
52 outcome rows/46 unique sources change only exact coordinate encoding,
dependency parameters and their numeric projections; topology, material,
opaque props, room cycles and host fields are unchanged. Maximum displacement
is4.714e-10 normalized (1.2e-7cm), below every source tolerance. These are #1282
lattice-anchor effects, not #1283 seam compaction in this corpus. Frozen v10
numeric oracles and the229-source archive remain unchanged.

Updating the shared current fixture is a separate deliberate source-data change.
Its current corpus membership/fingerprint must be audited on the composed tree,
not silently accepted as one of the52 runtime-only changes. The new #1285 replay
fixture contains no config document; its inventory row records configs=0.

## Canonical writer and lazy runtime boundary

The previous source assertion named the three-argument sender. #1287 adds the
roomLabels patch as the fourth argument after the same canonical adoption and
contact preflight; the updated assertion requires that exact argument. Behavioral
paired-write/Undo tests remain the authoritative runtime checks.

The raw-word any census grew1123→1154 in the independently accepted graph writer,
report and maintenance ports, including two ordinary comment words. Its exact
baseline is updated; static eager-import prohibition and the actual loader,
recovery and portable-type checks remain intact. No source cast is added here.
The release output keeps a per-line audit of that accepted source delta.

## Authoritative deletion

#244 now observes config/set removing the tombstoned device position and advancing
layout_rev atomically. Reusing the old layout revision must fail CAS. The revised
test verifies that refusal without a write, uses the fresh accepted pair for
space deletion and proves exact Undo restoration. Original event/write guards stay.

#819 keeps the deleted space's PDF while its one-deep Undo is live, actually
restores the pair/file, deletes again and expires Undo through an ordinary edit.
Only then is the orphan file unlinked; referenced attachments and one-write,
service/trail cleanup, revision and stale-CAS assertions remain protected.

## Real HA journey

The first beta attempt failed before the new gesture: the requested free figure
did not fit the visible1280px editor beside the existing walls and Properties.
The companion helper now declares a2000×1100 desktop viewport and45px pattern.
Its native Draw, exact q dependency, exported graph, Optimize no-op, unchanged
config/layout revisions and reload assertions are preserved.

The addressed repeat uses the original prepared beta.5 bytes on isolated HA2026.10.4:
2/2 business cases plus2 setup cases passed without skip, workspace
hp-e2e-first-run-dWMSfy. This is a diagnostic proof; the final frozen beta runner
must still produce its own combined report. The changed companion revision is
080bbbe5d793a10fd9388104874dbbc884edbe6f. Other newly extended room/space cases
will be executed in the requested post-publication stable profile.
