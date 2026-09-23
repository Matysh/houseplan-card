# House Plan furniture pack 0.4.1

Corrected derivative of the 0.4.0 built-in furniture artwork (#593, #606).

- `svg/menu/`: 33 front-view category illustrations, used only by the lazy
  editor bundle.
- `svg/plan/`: 60 top-view drawings used on the plan.
- `pack.json`: stable public ids, category links, default dimensions and names.
  The filename avoids the `*manifest.json` suffix reserved by HACS.

Corrections to 0.4.0:

1. The drawing in `plan/cactus.svg` is an exercise machine. It is unchanged
   geometrically and is now `plan/exercise.svg`, public id `exercise`, in the
   formerly hidden `exercise` category. Old saved `symbol: cactus` is resolved
   as a read-compatible alias by the application, not duplicated in this pack.
2. The *contents* of `plan/bookshelf.svg` and `plan/shelf_floor.svg` were swapped
   so each filename and unchanged public id shows the named furniture item.
3. All 33 menu categories now have a plan variant.
4. `menu/dishwasher.svg` uses the replacement front-view illustration supplied
   by JustBusiness in [issue #640](https://github.com/Matysh/houseplan-card/issues/640).
   Its reviewed source archive is `dishwasher.zip`, SHA-256
   `1A9B1BDAF490B35812F51E4DD3CB1C425224EC768219C31B979DD6A84E890203`;
   the path geometry is unchanged apart from safe repository normalization.
   JustBusiness supplied this asset for House Plan to use, modify and distribute
   under the repository MIT License without separate UI attribution.

The original 0.4.0 set of 93 SVG drawings originated with Sergey Matyunin
(`Matysh`). He granted House Plan permission to use, modify and distribute them
under the repository MIT License without separate UI attribution in
[issue #593](https://github.com/Matysh/houseplan-card/issues/593#issuecomment-5739841899).
The reviewed source archive is `houseplan-furniture-0.4.0.zip`, attached to
[issue #593](https://github.com/Matysh/houseplan-card/issues/593), SHA-256
`69BA5E0C398542D59F24269F637F57B8EBF31C2836C9D493F084AD29AB299FDE`.
This directory is a corrected derivative, not a new designer source archive.
`LICENSE.md` carries `JB (justbusiness)`, the same author under his own domain;
the authoritative name spelling is Sergey Matyunin, as decided in #369.

The editable source is linked from `pack.json`. Generated TypeScript must not
be edited by hand; run `npm run furniture:generate` after changing this pack.
