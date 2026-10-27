# Accepted #1087 / threshold-copy integration

Accepted #1087 introduced the HA-only `more_info_entity` setting. The existing
live virtual-copy helper retained it, while the strict backend correctly rejects
an HA target on a new virtual marker. The pre-fix actual helper payload and pure
accepted4c2 validator reproduction are retained here. The separate space-import
virtual-copy path already removed this field; it was not modified.

Small A fix: `c8d53565a23dd4f15e06d65a0722c1765524e813`, on accepted
`51fde59deaf24eebf823d9b5977edfea1315c38c`, removes the physical target with typed
`delete marker.more_info_entity` beside the existing light/toggle target cleanup.
It does not change backend validation, the source, alarm definitions or other
copy fields. Both changelogs accompany that A commit. B tests are separately in
`d50ce20234edfa7fd0eb1d011b50b64f45dd11e7`.

Pinned Linux proof, taskset0-3:

- Full `tsconfig.test.json` compilation passes; [compile.txt](compile.txt) is empty
  because the compiler completed without diagnostics.
- [Actual helper suite](actual-helper.txt): 8/8 PASS, including field absence,
  preserved independent alarm definitions and a completely unchanged source.
- [HA setup/Store/Copy WS suite](ha-handler.txt): 8/8 PASS. It uses the local
  synthetic HA `hass_ws_client` fixture: `websocket_api` setup, aiohttp WebSocket,
  fixture AUTH handshake and actual integration Store/CAS/Copy handler. It makes
  no claim about production transport, real credentials or a live HA installation.
- The added HA case first submits the retained bad target: strict
  `invalid_more_info_entity` rejection leaves the complete config/layout pair and
  both revisions unchanged. The cleaned request creates the virtual marker
  without that field, keeps the original marker byte-for-value and both source
  and copy alarm definitions, increments each revision exactly once and emits
  zero `call_service` events.

The initial local Git thin-pack fetch failure happened before tests. A verified
native bundle with existing fd62 prerequisite restored synchronization; the
ordinary remote fetch then succeeded. No alternates, guards, thresholds or
source data were changed to repair it. Original bddb remains preserved in refs,
verified bundles and `/home/matysh/s8-alerts-bddb-preserved-20261027`, including
its unchanged production tree with matching source fingerprint96c49947.

Final combined-source/gate proof still waits for actual #1070 S8.
