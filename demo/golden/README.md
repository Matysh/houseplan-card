# Visual reference images

Visual checks compare captured product screens with reviewed PNG references.
They catch seams and clipping, incorrect device states, lighting, editor chrome,
dialogs, narrow layouts and theme changes that a DOM assertion may miss.

The schedule and acceptance policy live in [PROCESS.md](../../PROCESS.md);
[TESTING.md](../../docs/TESTING.md) describes the test families. The shared
runner is `process-next/catalog/golden-runner.mjs`.

## What runs

- On a task, use a small addressed selection when the change needs visual evidence.
- Before beta, the profile captures 75 scenes: 61 through the panel,
  13 Lovelace card scenes and one native Static scene.
- Stable covers the remaining reviewed selection as well, reusing applicable
  successful beta results.

The exact selection is
[`process-next/catalog/golden-selection.mjs`](../../process-next/catalog/golden-selection.mjs).
Main UI frames use the panel. The smaller Lovelace selection covers that
embedding; it is not a substitute for the panel.

The source scenarios and dimensions remain in `matrix.mjs`. The shared
runner adapts those scenarios and reports only its selected set. It does not
claim that a missing reference passed.

## Capture and reports

Use the common beta/stable profile from the repository root; its plan can be
inspected without running it:

```sh
node process-next/cli.mjs plan --event beta --version "1.99.0 beta 1" --request release.json
```

The release request and execution command are documented in
[DEVELOPMENT.md](../../docs/DEVELOPMENT.md). The profile prepares the product
build, demo assets and test build before the browser step.

For an explicitly requested diagnostic of the visual selection, with
those inputs already prepared:

```sh
node process-next/catalog/golden-runner.mjs --selection=beta
```

`--selection=rest` addresses the remaining stable selection. It is not a
second mandatory run after an applicable successful report.
`--selection=all` addresses the complete set; `--scenario=ID` selects one
scene. `--mode=capture` produces images without claiming a successful pixel
comparison; `--mode=verify` is the normal comparison mode.

Outputs are in `artifacts/process-next/golden-beta/` or `golden-rest/`:
`actual/`, `diff/` and `golden-report.json`. Each scene reports its status,
image hash and pixel difference or a concrete error. Progress counts selected
scenes. A capture never edits reference PNGs.

## Reviewing and accepting a change

Review the actual image and difference, and explain whether the changed
appearance is intended. Do not change an expectation to conceal an unexplained
failure. New or changed scenes need their own visual decision.

After that decision, preview an addressed update:

```sh
node process-next/cli.mjs golden-accept --scenes scene-one,scene-two --report artifacts/process-next/golden-beta/golden-report.json --decision "source of the owner's visual decision"
```

Add `--execute` only to apply the already reviewed selection. The command
writes only named PNGs and their provenance in
`demo/golden/baselines/baselines-index.json`. It checks the selected report,
scene identity and captured PNG hashes before writing; unrelated references
stay unchanged. A differing selected image cannot be accepted without a
decision merely because an entire report exists.

This is the only acceptance route. Older capture/accept scripts are archived
under `legacy/process-v1/`; they are not an additional approval or validation
stage. Consolidation to one runner is recorded in
[CUTOVER.md](../../process-next/CUTOVER.md).

## Capture conditions and scene contracts

The runner needs the current built source and the configured Playwright
Chromium. It records browser/environment provenance and controls viewport,
locale, timezone, fonts, animation and caret. A stale bundle or an unavailable
browser is an environment failure, not a visual pass.

The scene harness keeps its semantic assertions: required controls must be
visible; a lit receiving room cannot be an empty pixel region; a clipped or
blank frame cannot become a meaningful reference. Runtime exceptions remain
failures.

Static capture suppresses transitions in existing and lazily attached shadow
roots, then restores them in `finally`. LED/dynamic smokes keep their own
lifecycle. Only the scenes explicitly listed in `scene-repaint.mjs` perform
the root-background repaint before capture. Preserve this capture behavior
when changing the runner.

The harness sets `window.__HP_VERSION_OVERRIDE__ = '0.0.0-golden'` before
creating the card and uses the same test version for the synthetic backend.
Version-mismatch scenes deliberately use `0.0.0-golden-backend`.
A version bump therefore need not alter every reference.

Grid-pan failures keep stage/SVG/marker geometry, grid styles, DPR and motion
classes after the screenshot. Those observations help diagnosis; they do not
convert a difference into success or request an automatic recapture.
