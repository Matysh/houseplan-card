# House Plan furniture pack 0.3.0

Canonical source artwork for the built-in House Plan furniture library.

- `svg/menu/`: 33 front-view category illustrations used only by the lazy
  editor bundle.
- `svg/plan/`: 44 top-view drawings used on the plan.
- `pack.json`: stable ids, category links, default dimensions and names. The
  filename deliberately avoids the `*manifest.json` suffix reserved by HACS.

The original author, Sergey Matyunin (`Matysh`), granted House Plan permission
to use, modify and distribute all 77 SVG files under the repository MIT
License without separate UI attribution in
[issue #159](https://github.com/Matysh/houseplan-card/issues/159#issuecomment-5454085168).

The reviewed source archive is `houseplan-furniture-custom-0.3.0.zip`, attached
to [issue #159](https://github.com/Matysh/houseplan-card/issues/159#issuecomment-5449707137),
with SHA-256
`9E969016EE3B4B4E3DB776FEC53C8B387B91368B118EB5E39911483DEF1B0953`.

The editable source is linked from `pack.json`. Generated TypeScript must
not be edited by hand; run `npm run furniture:generate` after changing this
directory.

Note (#369): the source archive referenced by the SHA-256 above may still
carry the earlier romanisation of the author's name; the authoritative
spelling is Sergey Matyunin (Сергей Матюнин), fixed 2026-08-29 by the
owner's decision in issue #369. The archive bytes are unchanged.
