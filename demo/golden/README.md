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
- Static capture temporarily suppresses transitions/animations in existing and
  lazy open shadow roots (#896), not just `document.head`. Per-scenario `finally`
  removes those styles and restores the attachment hook; LED/dynamic smokes do
  not install it. Docs capture shares the same scoped lifecycle, including
  stability-only and failing captures.
- Browser-argument helpers and their literal local dependencies enter both
  source/visual identity and the docs capture-script digest. Old receipts cannot
  be made current by changing a hash manually; re-capture and review normally.
- Only the explicit scene list in `scene-repaint.mjs` opts into a root-background
  repaint before its final capture (#881 and the proven editor frames, including
  `geometry-plan-editor-dark`, #1118): two frames with a temporary colour, then
  two with the original inline value/priority restored. This removes those
  scenes' demonstrated raster history without changing Chromium flags,
  fixtures, semantic controls or thresholds; every other scene keeps its capture
  path. Baselines are reviewed fully repainted frames, rather than historical
  partially rasterised variants. #1118 deliberately declares its one-AA-pixel
  canonical-frame change for the beta baseline review; strict unchanged checks
  are not relaxed and task branches do not accept global baselines.
- The browser is judged as it runs, not by its directory (#827, F33):
  `capture` and `verify` declare the pinned browser (`policy.mjs`), and the
  shared launcher compares every launched Chromium with the
  `chromium-headless-shell` pin of `playwright-core/browsers.json` — process
  version, Playwright, mode, the path Playwright selected and the binary that
  actually runs. A mismatch, a missing or an unprobeable browser is an
  `environment failure (browser-attestation)` before the first frame: nothing is
  captured, baselines and the index are untouched. There is no bypass;
  `npm run toolchain:check` shows the same report.
- Every scene line in the log carries the frame hash and the comparison:
  `<status> <id> sha256=<frame> diff=<px> ratio=<r> maxDelta=<d>`, or
  `error=<reason>`. A green Validate uploads no artifact, so repeated runs of
  one SHA are compared by these lines.
- `capture` writes only to ignored `artifacts/golden/`; it never changes a
  baseline and never claims a missing baseline passed. Any scenario runtime
  error makes capture fail, including the initial no-baseline CI run.
- `verify` requires every image plus a matching matrix manifest and fails on
  missing/different/error scenarios, browser mismatch or a baseline whose hash
  no longer matches the reviewed manifest.
- `accept` requires `--reviewed`, a complete candidate report, current source
  fingerprint and one explicit source of provenance: a GitHub Linux capture or
  the self-hashed WSL passport described below. It validates the whole set
  before copying anything and is the only command allowed to update baselines.
- `scripts/golden-accept.mjs` wraps `accept` and additionally requires the
  reviewer to declare intent, with two separate flags because they assert two
  different things. `--expect-change=<id,id>` means "I know why this existing
  baseline moved"; `--expect-new=<id,id>` means "I have looked at this new
  frame". Anything that differs, or arrives without a baseline, and is not named
  refuses the whole acceptance before a single file is copied; naming a scenario
  under the wrong flag refuses it too. Only the named scenarios are written:
  everything else keeps its reviewed bytes and its manifest hash, because
  `passed` means "within threshold", not "byte-identical", and copying every
  candidate let sub-threshold drift ratchet the baselines to the newest
  environment unseen (#351). The first flag is what makes a local
  capture admissible (see below) and blocks the one-command "accept everything so
  CI turns green"; the second stops an empty or clipped frame from becoming the
  contract unseen (#350).

## Displayed version (#512)

Frames never show the real `CARD_VERSION`. The harness sets the test seam
`window.__HP_VERSION_OVERRIDE__ = '0.0.0-golden'` before any card is created and
feeds the same constant wherever it plays the backend (`integration_version`,
support facts), so the about dialog, the version-recovery banner and the support
and backup previews print `0.0.0-golden` in every baseline. A beta bump therefore
changes no golden frame; the version-mismatch scenarios keep their own
`0.0.0-golden-backend` and still exercise the frontend≠backend relation. The
product never sets the seam (`src/card-version.ts`).

## Diagnostic workflow

Grid-pan failures retain post-screenshot stage/SVG/marker geometry, grid styles,
DPR and motion classes (#1133). These are diagnostics, not another comparison or
a retry. They cannot make a differing frame pass or justify baseline acceptance.

On every development track (#1044), `ci:golden` requests selected scenes and
semantic assertions. Expected differences/new scenes live in the issue's
release-ledger `visual` field; the schema, baseline-index hash command and
handoff evidence are documented in
[DEVELOPMENT](../../docs/DEVELOPMENT.md#browser-progress-checks-on-task-pushes-983).
The worker preserves selected frames/diffs under `artifacts/browser-selected/`
for review. It never accepts global baselines. Full verification, undeclared
scene checks and baseline acceptance belong to the beta candidate; nightly
pending drift does not become release proof.

Build and copy the exact current source first:

```bash
npm run build
npm run bundle:sync
npm run golden:capture
```

Review `artifacts/golden/actual/` and, when existing references are present,
`artifacts/golden/diff/`. A plain local capture is diagnostic and cannot be
accepted. To update references use one of the two reviewed-source workflows
below.

The CI-artifact path remains unchanged. Download and unpack the complete
`golden-images` artifact of a Validate run, review every declared frame, then:

```bash
npm run golden:accept -- --reviewed --from=<unpacked-golden-images> \
  --expect-change=wall-junctions-plan-t-dark
npm run golden:verify
```

Never accept images merely to make CI green. A matrix/framing change increments
`GOLDEN_MATRIX_VERSION`; a normal rendering fix does not. The first canonical
Linux baseline was reviewed and accepted during the v1.60.3-beta.1 gate.

## Attested WSL acceptance with one GitHub round trip (#641)

Accepting from the `golden-images` CI artifact remains the release path:
unpack it and pass `--from=...`. Capture and final verification are paid once
per beta batch, not for each visual task. The attested WSL path can remove the
expected-red artifact transport run when preparing that batch.

A local capture is admissible only through the repository's WSL/ext4 clone,
because admissibility is now *proved* rather than assumed. Publish the named
release preparation branch first and leave its worktree clean. The command refuses native
Windows, `/mnt/c`, a detached/dirty/unpublished SHA, pin drift and a stale build;
it then captures the complete current matrix and refuses undeclared changes,
missing frames or an insufficient byte-identical witness floor:

```bash
cd ~/houseplan-card
git fetch origin
git switch dev
git pull --ff-only origin dev
npm run golden:wsl:capture -- --expect-change=<the scenarios you changed>

# Review artifacts/golden/actual and diff, then use exactly the same intent.
npm run golden:accept -- --reviewed --from=artifacts/golden \
  --expect-change=<the scenarios you changed>
npm run golden:verify
```

The capture writes `artifacts/golden/wsl-attestation.json`. Its self-hash binds
repository/branch/commit/tree and remote SHA, WSL distro/kernel/architecture and
filesystem, Node/npm/Playwright identity, `package-lock.json`, source
fingerprint, matrix version, every scene's dimensions and PNG checksum, the
report checksum, witness count/floor and the declared acceptance intent. Its
Chromium is the headless shell that actually captures the frames (schema
`houseplan-golden-wsl/v2`, #833), not `chromium.executablePath()` (the full
Chromium): one standard headless launch is judged by
`scripts/browser-attestation.mjs` — expected and running version, the path
Playwright selected and the binary that actually runs — and the passport stores
the sha256 of that binary. A pin mismatch, a missing or an unprobeable browser,
or the F33 shape (a pinned directory name with another build inside) is an
environment failure and no passport is written. The accept command verifies the
same facts again before writing — the current headless shell must keep the
passport's version, path and sha256, otherwise "toolchain changed after WSL
golden capture"; a v1 passport is refused with that reason — and stores the
local provenance separately in `baselines-index.json`; it never pretends that a
local capture came from GitHub Actions.

The command prints the exact terminal trailer for the baseline commit:

```text
Release: vX.Y.Z-beta.N
Baseline-Reviewed-Local: sha256:<wsl-attestation hash>
```

Use either that local trailer or the existing `Baseline-Reviewed: <GitHub run
URL>`, never both. The local digest must match
`baselines-index.json.localAttestation.sha256`, which the commit hook and CI
provenance job verify. Push the accepted baseline commit and wait for a full
GitHub Validate on that exact SHA before the beta release. That final run
captures and checks the matrix independently; the WSL path removes only the
earlier expected-red artifact-transport run.

`scripts/golden-container.mjs` and plain `golden:capture` remain useful local
diagnostics, but their output has no WSL attestation and therefore cannot be
accepted. If the environment is not pixel-equivalent, unrelated scenarios come
out `different` anyway; a mismatched font set or browser can only fail.

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
