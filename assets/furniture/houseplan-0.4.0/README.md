# House Plan furniture pack 0.4.0

Canonical source artwork for the built-in House Plan furniture library.

- `svg/menu/`: 33 front-view category illustrations used only by the lazy
  editor bundle.
- `svg/plan/`: 60 top-view drawings used on the plan.
- `pack.json`: stable ids, category links, default dimensions and names. The
  filename deliberately avoids the `*manifest.json` suffix reserved by HACS.

This release replaces pack 0.3.0 together with its 12 retained code-drawn
primitives: every public symbol is now designer artwork, and `computer`,
`hood`, `oven` and `cactus` are new ids (#593).

The original author, Sergey Matyunin (`Matysh`), granted House Plan permission
to use, modify and distribute all 93 SVG files under the repository MIT
License without separate UI attribution in
[issue #593](https://github.com/Matysh/houseplan-card/issues/593#issuecomment-5739841899).

The reviewed source archive is `houseplan-furniture-0.4.0.zip`, attached to
[issue #593](https://github.com/Matysh/houseplan-card/issues/593), with SHA-256
`69BA5E0C398542D59F24269F637F57B8EBF31C2836C9D493F084AD29AB299FDE`.

`LICENSE.md` of this pack carries the copyright line `JB (justbusiness)`. That
is the same author under his own domain, not a third party; the authoritative
spelling of the name is Sergey Matyunin (Сергей Матюнин), fixed 2026-08-29 by
the owner's decision in issue #369.

One field differs from the archive on purpose: `symbols[cactus].menu_icon` is
`plant`, not `exercise`. The `exercise` category tile draws an exercise
machine, so opening it onto a cactus would misdescribe the palette. `exercise`
therefore stays an empty, hidden category and 32 of the 33 categories are
populated (owner's decision in #593).

The editable source is linked from `pack.json`. Generated TypeScript must
not be edited by hand; run `npm run furniture:generate` after changing this
directory.
