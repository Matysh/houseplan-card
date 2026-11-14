# Isolated standalone presentation

The runtime from #1422 supplies presentation primitives for a **dedicated
document without Home Assistant frontend**. It is not the standalone application,
server, distributable entry or persistence adapter; those boundaries are #1423
and the later phases of #1390. The current HA card/panel entries do not import
or activate it. The renderer, editor commands, Form Kit and modal lifecycle are
shared with the product, not copied into a second editor.

## Explicit owner

`registerStandalonePresentation()` performs one synchronous preflight before
defining exactly `ha-icon`, `ha-card`, `ha-circular-progress`. Repeated calls from
the same module/document are idempotent. Importing the module alone defines
nothing. Registration refuses an existing `home-assistant` root/definition,
`ha-dialog`, `ha-switch`, `ha-slider` or any foreign definition of the three
primitives; nothing is replaced and the registry is not monkey-patched.

These compatible **names** preserve the existing templates, styles and container
measurement consumers. The implementations are local functional primitives,
not HA classes or empty element shims. Do not install this owner into a loading
HA document. Embedding together with HA requires a separate document/iframe.
Late HA loading is unsupported: a repeated API call refuses the mixed document;
an already-open HpDialog retains its existing immutable native branch. There is
no attempt to make a subsequent foreign `customElements.define` succeed.

## Theme and presentation publication

```ts
let host: MyPlanHost | undefined;
const ui = createStandalonePresentation(container,
  { language: 'ru', darkMode: true },
  context => host?.publishPresentation(context));
host = createMyPlanHost({ presentation: ui.context });
// Supply this real host to the product before connecting its element.
card.planHost = host;
container.append(card);

ui.update({ darkMode: false });
ui.update({ language: 'de' });
// End the product lifecycle before restoring the embedding container's styles.
card.remove();
ui.dispose();
```

`MyPlanHost`/factory/publication in this example belong to the embedder, not this
module. The callback must **synchronously** replace the host environment's
presentation snapshot, advance `environmentRevision` and notify its environment
subscribers. The adapter does not own authority, permission, state, registry,
transport or subscriptions. No `hass` object is constructed or supplied.
Publication failure rolls back this call's CSS and retains the previous adapter
snapshot; publication itself must not partially commit and then throw. Async
publication is not supported. One active controller owns one container.

Each snapshot is immutable and contains only language, locale, themes and
localize. The finite HA-key bridge maps `ui.common.close` to House Plan's existing
`btn.close`. Translation is resolved **at call time**, so lazy German/French core
dictionaries and their settled English fallback stay consistent with the
product's language gate. Unknown keys return undefined. Languages are en/ru/de/fr;
no new locale or alternate dictionary is introduced.

The theme's base inputs derive from the neutral `demo/ui-lab/theme.css`, never
from a user's installation. `standalone-theme.ts` owns the light/dark values and
HA-compatible aliases consumed by UI Kit, including native `color-scheme` and
font-family inputs. A single update paints only the mount container and publishes
the matching `themes.darkMode`; no document-root palette or component paint is
duplicated. Dispose restores previously owned inline values/priority, preserves
unrelated/later external edits, and cannot unregister document definitions.
Different containers can own independent themes. Match the browser's emulated
`prefers-color-scheme` to the selected theme when comparing frames; existing
product media-query behavior is unchanged.

## Component contracts

| Primitive | Input and states | Accessibility / shared behavior |
|---|---|---|
| Local `ha-icon` | `icon` attribute/property; finite path or neutral unknown fallback; currentColor and `--mdc-icon-size` | Decorative SVG is aria-hidden/nonfocusable; button owns its existing label. Unknown names never become markup or network lookups. |
| Local `ha-card` | Ordinary slot and existing HA-compatible background/border/radius variables; product owns flex/viewport/Properties layout | No new role, focus stop or header behavior. Existing product DOM measurements still address the same container. |
| Local `ha-circular-progress` | `active` attribute; visible 48px default; existing size/ink hooks | Shared spin timing/keyframe, static arc in reduced motion, no focus stop. Namespace loading remains language-neutral with inert/aria-busy on its original owner. A status inside inert is not claimed as an AT announcement. |
| Native `HpDialog` | Existing title/icon/badge/wide/form shell/close public properties | Same focus trap/restore, native modal top layer, Escape/scrim/dirty/nested overlay/exit/disconnect rules. No local `ha-dialog` is defined. |
| Boolean/range/select/number/color | Existing native fallbacks and Form Kit owners, original values/disabled/events/min/max/step | No local `ha-switch` or `ha-slider`; existing keyboard, focus and commit behavior. Control paint, targets and motion remain UI Kit's responsibility. |

An unknown icon exposes `data-hp-standalone-fallback` for diagnostics. A known
reachable plan surface must have zero such fallbacks after settling; only the
explicit unknown/malicious-name test is expected to use it. The source inventory
is finite, generated by `node scripts/standalone-icons.mjs`; `--check` verifies
the current map. It is build-time tooling, not a runtime MDI catalogue query.
When adding dynamically assembled icons, include their finite alternatives and
exercise the real surface: collecting literal names alone cannot prove coverage.

MDI paths use the locked @mdi/js 7.4.47 source and retain Apache-2.0 notices in
`THIRD_PARTY_NOTICES.md` / `custom_components/houseplan/licenses/mdi.txt`. No HA
frontend, wheel, private module factories or icon API is borrowed. Font delivery,
full asset/license manifest and the standalone entry are #1423, not implied by
this adapter or the earlier #1393 shell probe.

## Evidence and limitations

`test/standalone-presentation-boundary.test.mjs` covers registry preflight, immutable theme
inputs and reproducibility/safety of the finite icon map.
`demo/smoke_standalone_presentation.mjs` builds an ignored **diagnostic same-graph
bundle** of the real card and adapter, sharing Lit and dictionary caches. It does
not touch the installed frontend snapshot or substitute a fake UI. The ordinary
HA build remains separate; #1423 will provide the real standalone entry/manifest.

The native scenario uses synthetic plan storage, a throwing presentation proxy
and no HA object/frontend. It inspects actual custom elements, native modals,
icons, focus, layouts and requests, not just a shell screenshot. Data migration,
portable serialization, backend validation/durability and production standalone
hosting are explicitly **not** proved by its wire fixture. Those positive
journeys require the real Python core in #1423. Existing HA/release scenarios
retain their own meaning. Generated screenshots are review candidates, not an
automatic acceptance or replacement of visual baselines.
