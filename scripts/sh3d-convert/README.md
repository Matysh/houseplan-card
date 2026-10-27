# External plan converter

User-facing site: <https://houseplan.tech/convert/>. Canonical scope and acceptance:
[#937](https://github.com/Matysh/houseplan-card/issues/937), issue-body spec.
This directory is a separately deployed tool, not a card entry/chunk. It emits
export-v2 **space** documents for House Plan **1.81.0 or newer**. Do not imply
support for an older backend just because it can read export-v2 envelopes.

## Boundaries

- SH3D XML/archive parsing stays bounded and local. Physical centimetres are
  preserved, inner room faces aligned to wall axes and near vertices welded as
  before. Independent wall remainders and floors without rooms now survive.
  Furniture/materials/cameras are still outside the SH3D profile.
- Easy accepts one `custom:easy-floorplan-card` YAML/JSON object, never searches
  an entire dashboard. Nonempty `floors` wins over legacy arrays. A shared frame
  and cm/unit coefficient preserve offsets and proportions across floors.
- picture-elements (#1022) accepts one `type: picture-elements` card object:
  the `image` becomes the backdrop reference and `state-icon` / `icon` /
  `service-button` / `state-badge` / `state-label` become markers and live text
  at `left`/`top` percentages of the image. Positions need the image
  proportions: the caller supplies `imageWidth`/`imageHeight` (with
  `imageMeasured:true` only for actual file measurement), or `aspect`; nothing
  is guessed. No rooms, walls or scale (1 cm/unit, `scale_default`). Entityless
  icons/buttons are virtual. The native default is information even for lights.
  Own-entity Toggle retains the runtime secure lock/alarm no-op. Exact single
  automation.trigger / script.turn_on / scene.turn_on, and a named script
  service without payload, map to existing Run; confirmation applies to
  Toggle/Run, with custom text/exemptions reported as loss. The stored flag on
  info/none is inactive and explicitly reported. Legacy service-button reads only
  service/service_data. Unsupported/broad/payload/foreign actions become
  explicit none for virtual markers or info for bound ones, never new commands.
  `conditional`, every separate `image` (static or stateful), custom cards,
  missing/numeric/px/outside positions and unsupported CSS are reported.
  Literal text colours and px font sizes within model limits are retained.
  Per-element source indexes/available IDs, stable loss codes and
  transferred/partial/skipped counts appear before download. Pending image
  decodes check the page generation and always close their bitmap; conversion
  waits for the selected image, while manual edits and newer sources win.
  A committed measurement refreshes both visible fields, including a focused
  field left active during a drop. Repeated IDs keep deterministic names without repeated
  collision scans, including the 2000-element input boundary.
- Scale: median ordinary single-swing door -> 90 cm; otherwise median known
  furniture dimension ratios; otherwise 1 cm/unit. It is an estimate, not a
  physical measurement. There is no mandatory calibration step; the user can
  calibrate `cell_cm` in the imported space.
- `geometry-entry.ts` imports the canonical DOM-free wall writer, coordinate
  canonicalizer and furniture catalogue. `build-runtime.mjs` compiles and bundles
  them into `geometry-runtime.generated.mjs`. Both readers use `modernDocument`:
  real wall segments, one wall ID per contour edge, exact compatibility `walls`
  projection required by the current backend, partitions and unambiguous hosts.
  Do not copy the algorithm or merely increase an output version constant.
- Easy is an **ordinary space**, not `plan_only`: explicit entity/Area links,
  marker/layout manifests, compatible tap/value/glow fields, LED geometry,
  furniture and live text are retained. Unknown furniture retains a rectangle
  footprint and label. Source positions are centres; HP decor boxes use top-left
  plus rotation about centre. Extra readings use live text, without executing
  templates/actions from the input.
- Theme/CSS expressions, service payloads, trackers, source-specific animations,
  conditional styles, door mechanisms and background image opacity are not
  silently copied. The report names omissions/approximations before download.
  Static braces become visible non-template braces. Safe `/local/` and HTTP(S)
  backdrop **references**, never credentials or bytes, are retained. A different
  HA must copy/replace the image; contain/cover becomes reported stretch because
  native image dimensions cannot be discovered without fetching the image.
  Query parameters are restricted to literal `v`/`version` (1–64 alphanumeric,
  dot, underscore, dash), `w`/`width`/`h`/`height` (1–10000), `q`/`quality`
  (1–100), `dpr` (1–4, up to two decimals), `format`
  (png/jpeg/jpg/webp/avif/gif/svg), and `fit` (contain/cover/fill/inside/outside).
  Unknown/duplicate names, invalid values and fragments omit the entire reference
  with `image_reference_skipped`; signed URLs are never stripped into broken ones.
- Eight MiB Easy input/export and two MiB config limits, YAML AST depth/node and
  geometry/object caps are enforced. Aliases/anchors/tags/directives, duplicate
  or prototype keys, non-finite numbers and ambiguous carriers fail closed.
  Existing HA preview/apply owns rights, duplicates and absent bindings; this
  tool performs no registry writes and sends no plan data over the network.
- The offline HTML bundles pinned `yaml` (ISC notice embedded), with no CDN or
  remote parser. Generation tokens invalidate old results/buttons on source,
  file or pasted-text changes, including delayed reads and errors.

## Build and verify

Target object-count/coordinate caps are generated from the trusted numeric
declarations in the real Python validators, not a second hand-maintained table.
The compiled-consumer unit reads the resulting space with the actual HP
lighting/compass/backdrop helpers, so an ignored forward-compatible field is
not mistaken for a working setting.

Run from the repository root after normal `npm ci`:

```sh
node scripts/sh3d-convert/build-page.mjs
node scripts/sh3d-convert/build-page.mjs --check
npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs
node --test test/sh3d-convert*.test.mjs test/easy-floorplan-*.test.mjs test/picture-elements-*.test.mjs test/converter*.test.mjs
.venv-backend/bin/python -m pytest tests_backend/test_sh3d_convert.py tests_backend/test_easy_floorplan_convert.py tests_backend/test_picture_elements_convert.py tests_backend/test_ha_sh3d_convert.py tests_backend/test_ha_easy_floorplan_convert.py tests_backend/test_ha_picture_elements_convert.py -q
node demo/smoke_plan_converter.mjs
```

The browser smoke attests the actually launched pinned browser. It exercises
the real artifact via file URL with blocked network, not a development wrapper.
It covers all three formats, YAML/JSON, downloads/CLI parity with the same
explicit clock metadata, manual/measured image proportions, delayed local image
completion and source/input races,
retained stale click closures, RU/EN and a 360px form. It does not claim a physical
GPU observation. Full HA apply/export runs in the Linux harness, not pure Python
or native Windows. Ordinary negative inputs are the cheap protective witnesses;
there is no claim of an executed mutant run.

CLI uses the same core. `--format easy|sh3d|picture` is explicit for picture-elements
(the default extension detector remains compatible with the two old formats):

```sh
node scripts/sh3d-convert/cli.mjs input.yaml --out /tmp/converted
node scripts/sh3d-convert/cli.mjs input.sh3d --out /tmp/converted
node scripts/sh3d-convert/cli.mjs --format picture --width 1600 --height 1000 card.yaml --out /tmp/converted
```

`--now` pins envelope time (default epoch in CLI); `--report` prints the report
instead of the documents. Golden JSON is generated by this CLI into `golden/`;
these are semantic import fixtures, **not** visual golden-image baselines.
`--aspect 1.6` is the alternative to `--width`/`--height`; neither mode fetches
the referenced image. Full/space JSON and full ZIP retain actions/fractional
positions; the existing plan-only privacy projection intentionally drops HA
bindings/actions/live reads. No import/transport protocol is changed.
The Node tests require output identity and the Python tests use the actual
schema/preview/apply/export, retaining independent physical/topology assertions.

## Deployment and rollback

Deploy only accepted code. Build/check the exact accepted material; record commit,
standalone artifact SHA256 and served-payload SHA256 in #937. On the authorized
demo/dev host the only destination is `/var/www/houseplan/convert/index.html`.
Do not touch Caddy configuration, HA, demo/dev seeds or services.

The currently served page has an extra site analytics header. Preserve its
existing wrapper/counters; do not overwrite it with a plain offline artifact.
The tool's own processing makes no network requests; this does not claim that
the live site's analytics header makes none. No input or result is sent to it.
Prepare a sibling temporary file; keep a timestamped copy of the exact current
page outside the web root; verify expected old digest before atomically replacing
the target. Compare the embedded converter module against the accepted artifact,
then HTTP-check both format controls and source version. No service restart is
needed. Rollback atomically restores the saved page, never rewrites user plans.
Do not publish HACS tags/releases as part of an external-site deployment.

`site-page.mjs --previous <downloaded-live.html> --artifact <dist/index.html>
--commit <full-accepted-sha> --out <prepared.html>` is a local preparer, not a
publisher. It preserves the existing Google/Yandex wrapper byte-for-byte, refuses
missing/duplicate/unexpected wrappers, asserts exact executable module identity
and prints old/artifact/wrapper/page digests. Its output remains local until the
accepted-material deployment described above.

## Public source fixture and license

`fixtures/easy-public-demo.json` is the card at
`views[0].sections[0].cards[0]`, mechanically extracted from
`docker/config/floorplan-demo.yaml` in
<https://github.com/nicosandller/easy-floorplan/tree/7a25bcfaa2cbf6dafcf013b71b7444c84bbd8f51>.
Source-file SHA256:
`bfb3fc347d5639e499774169fda2223c88e2fc5a0d059c5c628eaee357f76118`.
It contains public synthetic demo entity IDs, not a private HA installation.
The source snapshot, not a moving default branch, defines the supported profile.

MIT License — Copyright (c) 2026 Nicolas Sandller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
