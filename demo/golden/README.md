# HP-QA-01 golden images

This layer catches visual regressions that DOM smokes cannot: wall seams and
end caps, thick opening tunnels, Glow/sun clipping, hover contours, editor
chrome, the open contextual tray at wide/medium/narrow widths in English and
Russian (selection, tool options, group and palette), long dialog
titles/footers, mobile clipping, themes and zoom/remount. The desktop and
mobile device-dialog scenarios use a real light and make the complete
source-role, Glow colour, brightness and radius controls visible; capturing
only the top of that section fails the scenario before comparison.
The Glow matrix also keeps one deliberately opaque custom-fill scene with a
single source and two doorways: it makes hard spill wedges and fully unlit
radial spokes visible instead of hiding them under a translucent room fill.

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
- `scripts/golden-accept.mjs` wraps `accept` and additionally requires the
  reviewer to declare intent: every scenario whose capture differs from its
  accepted baseline must be named in `--expect-change=<id,id>`. Anything else
  that differs refuses the whole acceptance, before a single file is copied.
  This is what makes a local capture admissible (see below) and it
  simultaneously blocks the one-command "accept everything so CI turns green".

## Workflow

Build and copy the exact current source first:

```bash
npm run build
npm run bundle:sync
npm run golden:capture
```

Review `artifacts/golden/actual/` and, when existing references are present,
`artifacts/golden/diff/`. If every image is intentional:

```bash
node scripts/golden-accept.mjs --reviewed --expect-change=wall-junctions-plan-t-dark
npm run golden:verify
```

Never accept images merely to make CI green. A matrix/framing change increments
`GOLDEN_MATRIX_VERSION`; a normal rendering fix does not. The first canonical
Linux baseline was reviewed and accepted during the v1.60.3-beta.1 gate.

## Capturing candidates without a second CI round trip (#334)

Accepting from the `golden-images` CI artifact still works and is still the
safest route: unpack it and pass `--from=...`. It costs two full CI runs per
visual fix, though — one to produce the artifact and one to verify the accepted
baseline — and at matrix version 48 that toll is paid often.

A local capture is admissible instead, because admissibility is now *proved*
rather than assumed. Desktop font rasterisation can differ from the runner, but
it cannot differ quietly: it would move every text-bearing scenario, not only
the ones under edit. So the rule is simply that the capture must reproduce every
accepted baseline the reviewer did not intend to change:

```bash
node scripts/golden-container.mjs                      # capture in the pinned image
node scripts/golden-accept.mjs --reviewed --expect-change=<the scenarios you changed>
```

If the environment is not pixel-equivalent, unrelated scenarios come out
`different`, the wrapper names them and refuses. A wrong container tag or a
mismatched font set therefore cannot corrupt baselines — it can only fail.

`scripts/golden-container.mjs` derives the image tag from the `playwright`
version locked in `package-lock.json`, so the container Chromium equals the
runner's; `--image=` overrides it when a distro-specific tag is needed
(`...:v1.62.0-jammy`). The host `node_modules` is shadowed by an anonymous
volume: the repository copy may be built for Windows, and `npm ci` inside the
container would otherwise replace it with Linux binaries. The run does write
`dist/` and the three bundle copies, exactly as a local `npm run bundle:sync`
would.

Docker is not a requirement of the rule, only a convenience: any Linux
environment that satisfies the parity condition qualifies, WSL included. The
`chromium` string recorded in the manifest keeps the browser build itself
pinned, and `golden:verify` rejects a manifest captured by a different build.

`scripts/golden-accept.mjs` deliberately wraps `demo/golden/accept.mjs` instead
of replacing its checks: every `.mjs` under `demo/golden` belongs to
`sourceFingerprint`, so editing the acceptance tool itself would declare the
committed bundle, the documentation screenshot manifest and the baseline
manifest stale — the very double round trip this change removes. Narrowing that
corpus is worthwhile but separate: `scripts/source-fingerprint.mjs` is itself a
build input, so any change to it forces one bundle rebuild.

Scenarios may also declare a semantic pixel region (for example, a receiving
room that must contain warm light). `golden:capture` and `golden:verify` reject
the capture before baseline comparison when that visual precondition is empty;
a reviewed but meaningless PNG therefore cannot become the contract.
