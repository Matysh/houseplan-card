# House Plan furniture pack 0.3.0

Canonical source artwork for the built-in House Plan furniture library.

- `svg/menu/`: 33 front-view category illustrations used only by the lazy
  editor bundle.
- `svg/plan/`: 44 top-view drawings used on the plan.
- `pack.json`: stable ids, category links, default dimensions and names. The
  filename deliberately avoids the `*manifest.json` suffix reserved by HACS.

The original author, Sergey Matyushin (`Matysh`), granted House Plan permission
to use, modify and distribute all 77 SVG files under the repository MIT
License without separate UI attribution in
[issue #159](https://github.com/Matysh/houseplan-card/issues/159#issuecomment-5454085168).

The editable source is linked from `pack.json`. Generated TypeScript must
not be edited by hand; run `npm run furniture:generate` after changing this
directory.
