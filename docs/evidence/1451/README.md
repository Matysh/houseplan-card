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

Current capture source commit: `001ffa9b3c7f67a95201b7815214d2470dfdf64b`.
Candidate artifact digest:
`3e6770d0a2ea3ed7a3cdc451bb837e18dc37d48d07734e16f0c022dd66c24745`.
Frontend fingerprint:
`79c46894433b53fd5c69b0d7b350434e0e702d01b203476eedfe6c227ea486e4`.
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
  current001 candidate. Both camera journeys passed four sides, Flat editor
  roundtrip and reload, with saved config/layout/revisions unchanged and no
  view-only writes (2/2 PASS).
- [Straight workstation after reload](native-desk-reload.png) and
  [corner workstation after reload](native-corner-desk-reload.png): source
  `bf8dfb97e7d9b21c823c27cae74e1a642dd90faa`, earlier in the same task.
  Both mount/detach/history/reload/ACL journeys passed; the camera-only change
  did not affect them and they were not unnecessarily rerun.

These six PNGs total1,851,077 bytes. SHA256:

| File | SHA256 |
| --- | --- |
| comparison-light.png | ef84f813061b288e8784bc1421b9bb7b95b05a4ed1fbd092f11d931b1a2b0cd7 |
| comparison-dark.png | 04cac08e59a6babae293b50738953fd719c9d9e18ed87f1093e09f343970594c |
| native-panel.png | 680c33b83c4911007f737b49806e9c7922e5f01b4f884525c91d6c13d5043fec |
| native-card.png | 57ede0012e8f60a5be4ff3923b022ac374c32a063c3b18dfa085d458b49ba4c4 |
| native-desk-reload.png | 0fca85624087bb855c41f5b617bc4fb02f4ef5f65f32bac0ef5d7aa6288ec307 |
| native-corner-desk-reload.png | 68f7ab81aa41b374e09653a02f907b60131cf47498ba1d234ba197bae6db2319 |
