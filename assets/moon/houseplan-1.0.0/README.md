# House Plan moon pack 1.0.0

Designer asset for [issue #661](https://github.com/Matysh/houseplan-card/issues/661)
(moon in its current phase on the "Follow the Sun" background), variant A:
one full-moon image, the phase is applied by the card as an SVG mask (C5).

- `moon.svg`: square `viewBox="0 0 512 512"`, disc centred at (256, 256),
  diameter 480 (16 px margin for anti-aliasing). Full moon, front-lit: no
  terminator, no shadow, no halo or glow outside the disc, no baked phase.
  Near side, north up, Mare Crisium on the right; the art is never mirrored.
  Owner 2026-09-29: the lit side is always the left one (as in the designer's
  phase sequence), waning runs the same states backwards; only the mask flips.
  Owner 2026-09-30: a distinct state for every day of the lunar month; the mask
  is continuous, so the card simply uses the daily illumination k.
  The dark side is not drawn: the card renders the same art at 8 % opacity.
- Edge: one radial gradient ring with no hard outer edge (as in the designer's
  Figma export): bright rim 0.855-0.90 R, dark outline `#2b3138` at 50 % from
  0.905 R to 0.92 R (owner 2026-09-29, for a forced white background), then a
  1.5-unit fade to transparent by 0.935 R (r 239.4 in the 512 box, inside the 480
  disc). The soft limb hides any missing anti-aliasing of the outer edge.
- The disc is masked (`<mask>`), not clipped: Chrome with GPU rasterisation draws
  `clip-path` edges without anti-aliasing (seen on Windows), masks are anti-aliased.
- Art by JB (Figma, `House-plan` file). The Figma export (`source/figma-export/Full.svg`
  in the source archive) was normalised for the pack by `source/convert_jb.py`:
  viewBox 200 -> 512 (scale 2.56, disc clipped at r 240), the `mix-blend-mode`
  screen ring and multiply groups removed (blend modes depend on the stacking
  context they land in, so the file now composites normally and looks the same
  everywhere), the three 5-7 % crater layers and the 484-path speckle texture
  dropped (invisible at 200 px), and each mare "blend" of 22 nested rings
  thinned to 4 rings (steps 0, 8, 16, 21). The export's screen-blended edge ring is rebuilt
  as a normal-composited radial gradient (the art is masked at r 230), so the feathered edge is part
  of the 480 disc and nothing is drawn outside it. Path coordinates rounded to 0.1, gradient offsets kept at 0.001 (`svgo.config.mjs`).
- Vector only: two `radialGradient`s (disc, edge), one `mask`, paths. No `filter`,
  `feGaussianBlur`, `feImage`, embedded raster, fonts or external references.
  25.6 KB raw, about 9 KB gzip.
- Colours: disc `#949493` (centre) -> `#D6D5D4` (rim), maria grey rings
  `#404040 -> white` under a 0.2-0.6 group opacity. Checked on the night
  (`#111a27 -> #1f2f3e`), dusk (`#48536c -> #9a7380`) and dawn
  (`#aabdd1 -> #e8c8b7`) palettes at 200, 120 and 94 px.
- `pack.json`: pack id, version, licence, source link and the disc geometry
  for `scripts/generate-moon-assets.mjs`.

JB (justbusiness) supplies this asset for House Plan to use, modify and
distribute under the repository MIT License without separate UI attribution
(`LICENSE.md`). The reviewed source archive with its SHA-256 is attached to
issue #661. Generated TypeScript (`src/moon-art.generated.ts`) must not be
edited by hand; regenerate it from this pack.
