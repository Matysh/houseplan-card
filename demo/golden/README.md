# HP-QA-01 golden images

This layer catches visual regressions that DOM smokes cannot: wall seams and
end caps, thick opening tunnels, Glow/sun clipping, hover contours, editor
chrome, long dialog titles/footers, mobile clipping, themes and zoom/remount.

## Safety contract

- A build fingerprint embedded by Rollup must match `src/`, Rollup/TypeScript
  configuration and locked package inputs; stale committed
  demo bundles fail before the first screenshot.
- Chromium, viewport, locale, timezone, colour profile, font rendering,
  animations and caret are controlled by the runner.
- `capture` writes only to ignored `artifacts/golden/`; it never changes a
  baseline and never claims a missing baseline passed. Any scenario runtime
  error makes capture fail, including the initial no-baseline CI run.
- `verify` requires every image plus a matching matrix manifest and fails on
  missing/different/error scenarios, browser mismatch or a baseline whose hash
  no longer matches the reviewed manifest.
- `accept` requires `--reviewed`, a complete candidate report and current
  source fingerprint. It validates the whole set before copying anything and
  is the only command allowed to update baselines.

## Workflow

Build and copy the exact current source first:

```bash
npm run build
cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js
npm run golden:capture
```

Review `artifacts/golden/actual/` and, when existing references are present,
`artifacts/golden/diff/`. If every image is intentional:

```bash
npm run golden:accept -- --reviewed
npm run golden:verify
```

Never accept images merely to make CI green. A matrix/framing change increments
`GOLDEN_MATRIX_VERSION`; a normal rendering fix does not. The first reviewed
baseline set is intentionally deferred to the next pre-release gate, because
the owner's process forbids running builds/tests during ordinary local edits.
Use the `golden-images` artifact produced by the Linux CI job as the canonical
review set: desktop font rasterisation can differ from the CI environment even
with the same pinned Chromium. Pass its unpacked root via `--from=...` when
accepting it locally.
