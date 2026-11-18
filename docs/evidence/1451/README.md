# #1451 public visual evidence

All images contain synthetic data only. No owner HA data, authentication files,
private seed or personal UI Lab session is included. Main execution report:
[1451-accepted-25d.md](../1451-accepted-25d.md).

## Accepted PNG reference comparison

[Light: four pairs](comparison-light.png) and
[dark: four pairs](comparison-dark.png) cover yaw35/125/215/305 degrees.
Each pair shows an accepted PNG from
[DEV-HANDOFF-ff45c3ef.zip](https://github.com/user-attachments/files/35034114/DEV-HANDOFF-ff45c3ef.zip)
and a new 1480×1080/DPR1 synthetic-scene capture, downscaled into the contact
sheet. All eight current views were inspected. The private source scene was
not supplied; the owner authorized comparison on a synthetic plan. These are
element/form/camera comparisons, **not exact-pixel or same-scene equality**.
Saved room layout, colors, light/opening states, background and fit differ.
No baseline was updated.

Current capture source commit: `60f6eeb34695c616ba10343dab390e5cfce202ff`.
Candidate artifact digest:
`af2474e9fef4aaca41a84381ff4bc92db8557c68d66a2ba4167376953a89217b`.
Frontend fingerprint:
`375cf03488a4de90bfd5c086587dbf2772ce23d6bf494c0461ae287fd58943d2`.
Synthetic fixture SHA256:
`59770f7d9ae62c246b0cd840ad79e994c7e012f0337cd3f5b0fb486e30115596`.
UI Lab component harness20260930.4, Playwright1.63.0,
Chromium153.0.8010.12; this harness is not the genuine HA runtime below.

## Genuine native HA samples

HA2026.11.1, Playwright1.63.0, Chromium153.0.8010.12, 1480×1080/DPR1.
The isolated loopback HA was installed from prepared candidate files as on
disk; the E2E tests used ordinary UI and real backend replies, no Lab switch
or private card API.

- [Panel at35°](native-panel.png) and [Lovelace card at35°](native-card.png):
  current60f6eeb candidate. Both camera journeys passed four sides, Flat editor
  roundtrip and reload, with saved config/layout/revisions unchanged and no
  view-only writes (2/2 PASS).
- [Straight workstation after reload](native-desk-reload.png) and
  [corner workstation after reload](native-corner-desk-reload.png): source
  `bf8dfb97e7d9b21c823c27cae74e1a642dd90faa`, earlier in the same task.
  Both mount/detach/history/reload/ACL journeys passed; the camera-only change
  did not affect them and they were not unnecessarily rerun.

These six PNGs total1,962,872 bytes. SHA256:

| File | SHA256 |
| --- | --- |
| comparison-light.png | 1079c3b2f4f89c939e3d3944d1e67777d19f0cb064a761f14c0eeabbabe2a123 |
| comparison-dark.png | 29161973770be18ba47feaafc294d3d0819d6013b582fbdbbe7ec20ad4e60906 |
| native-panel.png | 680c33b83c4911007f737b49806e9c7922e5f01b4f884525c91d6c13d5043fec |
| native-card.png | 2dbbbc96ac4fa310e16380f093e9fcfeec18d81fa1f6f8966231079620b74bd2 |
| native-desk-reload.png | 0fca85624087bb855c41f5b617bc4fb02f4ef5f65f32bac0ef5d7aa6288ec307 |
| native-corner-desk-reload.png | 68f7ab81aa41b374e09653a02f907b60131cf47498ba1d234ba197bae6db2319 |
