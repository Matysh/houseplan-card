# Real 3D research — #1471

Isolated research MVP, **not a product implementation**. See
[the Russian report](REPORT.ru.md), [visual review](review.html), and
[the issue](https://github.com/Matysh/houseplan-card/issues/1471).

```sh
npm ci --prefix research/real-3d --ignore-scripts
npm run build --prefix research/real-3d
npm start --prefix research/real-3d
# http://127.0.0.1:8317
```

The MVP reads the existing product geometry as source imports. A fixed
synthetic plan feeds real Three.js meshes and a minimal SVG control renderer.
Device actions only change local laboratory state. No HA connection or saved
3D model exists. Root package files and product sources remain unchanged.

Optional research diagnostics (Windows GPU setup is explicit in the scripts):

```sh
node research/real-3d/measure.mjs
node research/real-3d/capture.mjs
node research/real-3d/make-review.mjs
```

`product-probe.mjs` additionally needs the ordinary product dependencies and
`npm run bundle:sync`, then uses its unchanged synthetic demo harness.
`inspect-competitors.mjs` performs anonymous public-page reads; it never logs in,
creates accounts or submits a project. No third-party source/art is copied into
the MVP. Engine licenses: Three.js MIT, Babylon.js Apache-2.0, PlayCanvas MIT,
OGL Unlicense. Dependencies are pinned in this folder's lockfile.

`evidence/measurement.json` contains the final hardware-verified run. Earlier
software-renderer and unoptimized exploratory numbers are excluded. These
standalone diagnostics do not register new global product gates, claim a full
stable test run, or accept product visual baselines. Read the report's explicit
limitations before comparing the SVG control with actual Houseplan.

Rebuild generated `out/` locally. The branch is retained for inspection and is
not submitted to the merge queue: the owner requested research only.
