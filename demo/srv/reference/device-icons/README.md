# Device icon visual references

These SVG files are a demo/test-only subset of the normative designer package
for issues #179 and #211. They do not ship in the production bundle.

- Package: `House Plan Icons — Developer Package` 1.1.1
- Export: 2026-08-19
- Source archive SHA-256:
  `63670C73E25D1E59DDAF1BE236F3D7F2FAC827B9B5D6DD4B77125EA9BC012025`
- Owner override #219: package geometry remains normative, but Lock/Unlock
  paint is projected at runtime as closed green `#66D17A` and open red
  `#F0410C`; glyphs are white in Light and `#252525` in Dark. The SVG files stay
  byte-identical source evidence, while the smoke and comparison capture apply
  this explicit product override.

`demo/smoke_device_icon_design.mjs` reads the SVG attributes directly for the
computed-style contract. `demo/capture_device_icon_reference.mjs` builds a
human-reviewable Reference SVG / Runtime matrix under
`artifacts/device-icon-reference/`.
