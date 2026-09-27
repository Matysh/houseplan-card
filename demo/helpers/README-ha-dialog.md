# Offline authentic HA dialog fixture (#505, #607, #609)

`demo/helpers/ha-dialog-fixture.mjs` serves the synthetic demo together with the
official, pinned Home Assistant `ha-dialog` so a diagnostic can exercise the
real component. It is **not** a `smoke_*` entry, a golden-baseline producer, or
a Home Assistant server, and it never connects to a real HA instance. It was
built for the #505 summary-panel parity work
([`505-summary-panel-design-parity.md`](../../docs/specs/505-summary-panel-design-parity.md));
that one-off capture script and its designer prototype were removed by #681 and
remain in git history. Two diagnostics use the fixture today.

#607 verifies the real HA close button:

```sh
npm run bundle:sync
node demo/verify_ha_dialog_discard_recovery.mjs
```

That diagnostic opens Device, Room, Space and General settings in turn. For
each form it edits a field, presses HA's own close button, chooses Continue,
proves that the same modal and draft are interactive again, then covers
Discard and a clean close. It also fails on duplicate `hp-close` events,
external requests, WebSockets or browser errors. The ordinary native-fallback
contract remains in `demo/smoke_dialog_modal_recovery.mjs`.

Issue #609 uses that same unmodified pinned `ha-dialog` to verify the shared
settings-form shell rather than the close lifecycle:

```sh
npm run bundle:sync
node demo/verify_ha_form_shell_609.mjs --capture
```

It opens the real Room settings form and checks the settled WebAwesome surface:
560 px desktop width, the 940 px/viewport height cap, zero duplicate HA body
padding, one HA-owned scroller, a distinct form canvas, footer containment and
edge-to-edge layouts at 480×800 and 390×844. It also keeps HA's own fullscreen
behaviour for a 1280×480 viewport. `--capture` writes the diagnostic images into
the ignored `artifacts/ha-form-shell-609/`; without it the command is
read-only. The authentic diagnostic explicitly applies the light palette,
then repeats desktop geometry in the dark palette with a 32 px root font and
proves that canvas contrast, the single HA scroller and the footer survive.
The fast Validate witness is
`demo/smoke_ha_form_shell_parity.mjs`; neither diagnostic is a golden producer.

The first explicit run downloads the official 124,294,469-byte
`home-assistant-frontend==20260729.7` wheel from the exact allowlisted PyPI file
URL; version, size and SHA-256 are pinned in `ha-dialog-assets.mjs`, checked
before extraction, and checked against `tests_backend/requirements.txt`.
The wheel is **not installed**. Only allowlisted modern JS/static assets are
extracted to the OS temporary cache. The deterministic cache manifest has its
own pinned hash; existing extracted bytes are then checked against its per-file
hashes each run, so edited cache metadata is not trusted. After corruption,
remove that temporary cache directory; the tool does not delete existing data.

To reuse an already downloaded official wheel, point `HP_HA_DIALOG_WHEEL` at
it. There are no author-machine paths in the helper; cache contents and
screenshots are never committed.

## Authenticity and safety boundary

The official `app.d53ce8172fc8c85d.js` is served with one explicit runtime
instrumentation: its final `o(91535);` becomes
`window.__ha505Require=o;o(91535);`, exposing its otherwise private module
loader. The downloaded wheel and the `ha-dialog`, WebAwesome, Lit and other
component factories/styles remain unmodified. Numbered official ESM chunks
register their original factories with that loader; there is no dialog stub.
This is a genuine-component diagnostic, **not** a complete production HA boot.

No `core.*` entry, authentication root or HA server is loaded. The server binds
only `127.0.0.1` on an ephemeral port. A restrictive CSP, browser request
allowlist, blocked service workers and throwing WebSocket constructor prohibit
external/HA requests; any attempted external request, WebSocket or page error
fails the run. The synthetic demo HTML is adapted only in its served response
to await the authentic component bootstrap and avoid duplicate icon/card tag
registration. No production HA configuration, devices or services are touched.
