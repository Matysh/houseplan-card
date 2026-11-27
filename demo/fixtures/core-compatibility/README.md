# Historical core producer fixtures

Synthetic native ZIPs created by the real exporters at v1.86.0
(2725feedd276c5c1c19d9223c99b1adcdefefaa1) and v1.86.1
(f175b7e00d8535149c61c2d28a922620a3a70928). No owner data or HA is used.
Each stable's own reader verified its output before it was saved.

The fixed clock and source identity, along with each archive SHA-256, are in
provenance.json. Run tools/generate_core_compatibility_fixtures.py --out with
a fresh directory to reproduce byte-for-byte; never replace old producer bytes
with a current-exporter approximation. Both formats include the same PNG on
two floors, stairs, room-label positions; only full backup retains a marker.

The default installed core conformance reads all four archives. Its assertions
cover images, geometry, labels, the binding boundary and additive house remap.
Full backup is parsed without HA or restore privileges; its HA restore path
is outside this pure-core fixture's claim.

See docs/CORE-HOST.md#compatibility-and-versioning.
