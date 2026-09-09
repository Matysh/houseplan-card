# Offline authentic HA dialog evidence (#505)

This is an explicit diagnostic, **not** a `smoke_*` entry, a golden-baseline
producer, or a Home Assistant server. It never connects to a real HA instance.
Issue/spec: [#505](https://github.com/Matysh/houseplan-card/issues/505),
[`505-summary-panel-design-parity.md`](../../docs/specs/505-summary-panel-design-parity.md).

From a checkout with the usual `npm ci` dependencies and Playwright Chromium:

```sh
node demo/capture_summary_panel_505.mjs --probe-only
node demo/capture_summary_panel_505.mjs --output artifacts/summary-panel-505
```

The second command requires an already fresh `npm run bundle:sync` result.
It never builds or changes product/reference files, and refuses stale source
fingerprints even when `HP_ALLOW_STALE_BUNDLE` is set. For reviewer work, use
`--output "$RUNNER_TEMP/summary-panel-505"` to keep all evidence outside the checkout.
Use `--only edge-real-ha-text-200-long-de-390` for a named focused recapture;
comma-separated names are accepted and recorded as a partial selection.

The first explicit run downloads the official 124,294,469-byte
`home-assistant-frontend==20260729.7` wheel from the exact allowlisted PyPI file
URL; version, size and SHA-256 are pinned in `ha-dialog-assets.mjs`, checked
before extraction, and checked against `tests_backend/requirements.txt`.
The wheel is **not installed**. Only allowlisted modern JS/static assets are
extracted to the OS temporary cache. The deterministic cache manifest has its
own pinned hash; existing extracted bytes are then checked against its per-file
hashes each run, so edited cache metadata is not trusted. Use a new cache directory
after corruption; the tool does not delete existing data.

To reuse an already downloaded official wheel or select a disposable cache:

```sh
node demo/capture_summary_panel_505.mjs --probe-only --ha-wheel /path/to/home_assistant_frontend-20260729.7-py3-none-any.whl --ha-cache /path/to/cache --output /path/to/evidence
```

`HP_HA_DIALOG_WHEEL` also supplies a local wheel. All paths are caller-selected;
there are no author-machine paths in the helper. Cache contents and screenshots
are not committed.

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

## Evidence and limits

`report.json` records source SHA/fingerprint, Chromium/platform, wheel pin/hash,
measured surface/editor/footer/control geometry, actual shadow-component
presence, typography and network errors. The standalone probe proves the
small320/medium580/public inherited-width920 contract plus mobile390 fullscreen.
It does not load House Plan; the full settings cases exercise actual `hp-dialog`.

The full command writes paired viewport/region PNGs for five panel contexts
(desktop light/dark, portrait bottom, kiosk, mobile View), native/real-HA
settings at desktop/320/390 in both themes, and enlarged-text/long-German
source edge cases. One default block has three system rows plus one entity row
on both sides. Reference displayed values are normalized to measured product
values **only as fixture text**, not CSS; original reference files stay intact.
The archived prototype UI is Russian; German stress changes fixture data and
product locale, not the archived prototype UI translation.
Long-source start/end images use `scrollIntoView` and record the actual composed
scroll owner plus source/label visibility between header and footer. This matters
because genuine HA scrolls its shadow body, not necessarily `.summary-editor`.

The 800×500 case is explicitly an effective-viewport proxy for a 1600×1000
display at 200%, **not actual browser zoom**. Separate 32px root-font cases
exercise enlarged text. HA normally uses a 14px root, so the report includes
actual computed font sizes. Different fake HA chrome/floor-plan pixels are not
parity targets. Fullscreen HA rules, HA typography/theme, larger touch targets
and the native disabled Save action remain the spec's allowed adaptations.

`status: complete` means capture completed, not design acceptance. Inspect the
PNGs and the settings `checks`; these files are diagnostic evidence outside
canonical `demo/golden/baselines` and docs screenshot manifests. Regenerate on
the reviewer's pinned checkout and record the exact command/report paths.
