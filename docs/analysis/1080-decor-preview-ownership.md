# Decor preview ownership #1080 — author evidence

The fix keeps the existing settled and live renderers. A live frame prepares
its actual transient kind before hiding the matching settled kind; the existing
host-update commit restores settled paint and clears live paint synchronously.
Only `.ddraft`, `.furniture-placement-preview` and
`.decor-image-placement-preview` participate. Saved decor is not selected by
these selectors. An obsolete frame ID or disposed state cannot paint a later
action. Lost capture of a rectangle/ellipse draft uses the existing cancellation
terminal path, as Line and backdrop already do.

## Preview inventory

| Kind | Existing owner and neighbour |
|---|---|
| Furniture | `_furnPreviewInput` / furniture placement; the actual designer path is rendered by both layers. |
| Image | The same pointer input plus the selected ready asset; unresolved URLs render nothing and cannot hide a nonexistent live image. |
| Line | Existing `DecorLineDrawing` session supplies `.ddraft`; a native first click plus movement exercises it. |
| Rectangle / ellipse | Pointer-owned `_decorDraft` supplies `.ddraft`; native capture loss now cancels it before the next movement. |
| Text | There is no separate unsaved canvas-placement preview: the click opens the existing text dialog. Saved text measurement/transform remains a neighbour in `smoke_decor_text.mjs`. |
| Backdrop / saved-object transform | Existing frame and selected-object suppression remain separate; this change adds no global decor hide. |

## Executed observations

On the actual unchanged accepted `8b74e7888` source, the final native smoke
returns RED: the first furniture footprint has 1453 changed pixels and all
1453 remain at its old position after movement. Presented-frame ownership,
furniture, line/rectangle/ellipse/image duplicates and both lost-capture cases
also fail. On the fixed source that crop has zero changed pixels; all listed
ordinary cases pass. No modified implementation is executed for this comparison.

The accepted UI-038 reference is pinned to `e6a4edc8`; its package was verified
by the reference launcher. Independent reference and candidate pages receive the
same synthetic fixture, theme, viewport 1440×1100 and DPR1. Both have one visible
preview, equal path/transform/stroke and identical 9039-pixel preview crops
(zero pixels differ by more than three channel values). Accepted adapters run
only in the reference page. This is a new synthetic comparison, not a claim that
private historical screenshots were opened or reproduced.

Actual combined candidate `50456362a3cd86cef68d800c6d93309ae60707a2`
merges #1080 material `0a4984dec` and #1081 material `783c889d` solely for
local acceptance. A fresh pinned WSL production build passes both
`node demo/smoke_furniture_pan.mjs` and
`node demo/smoke_decor_preview_ownership.mjs`. The UI-037 source is not copied
into the #1080 task branch and this temporary merge is not release authority.

## Exact lifecycle witnesses

| Contract | Executed witness |
|---|---|
| Full HA render → live movement | `smoke_decor_preview_ownership.mjs`: `preview.old-position.no-painted-footprint`, `preview.presented-frames.one-owner-without-blank`; screenshots at each handoff. |
| Hover/Cancel writes nothing; placement writes one object/step | Same smoke: `preview.hover.*`, `preview.cancel.*`, `preview.commit.one-object`, `preview.commit.one-history`. |
| Tool/item/space/mode changes and reconnect | Same smoke: `preview.changed-symbol.no-old-art`, `preview.changed-tool.no-ghost`, `preview.changed-space.late-full-render.no-ghost`, `preview.view.no-editor-ghost`, `preview.reconnect.no-retired-ghost`. |
| Native pointercancel / actual capture loss | Same smoke: `preview.rect.pointercancel.no-ghost`, `preview.ellipse.pointercancel.no-ghost`, both `lostpointercapture.no-ghost` cases and exact saved-data negatives. The actual capturing element is released; the next native pointer event delivers the terminal event. |
| Stale scheduled callback | `node --test test/live-editor.test.mjs`: `#1080 a cancelled or detached frame cannot paint or consume a later action`. |
| Delayed artwork / detach | `node --test test/furniture-art-runtime.test.mjs`: `#1080 delayed artwork does not update a detached preview host or replay after reconnect`; existing pending/adopt/foreign-build cases remain. On a connected new space, a later ordinary full render reads only current input; the browser space witness exercises that boundary. |
| Touch cancellation / no unintended placement | `smoke_furniture.mjs`: `touchCancelMoveAndSecondContactDoNotSave`; `smoke_decor_images.mjs`: `cancelledTouchDoesNotPlace`. |
| Text / View / kiosk | `smoke_decor_text.mjs` and `smoke_furniture.mjs` (`visibleInView`, `inertInView`); `smoke_kiosk.mjs` exercises a fresh real kiosk card. |
| UI-037 pan + UI-038 cleanup | The actual combined candidate runs the native pan smoke: drag adds nothing, clean click adds one, cancellation/capture loss/blur/right-button/space guards remain; the preview smoke also passes there. |

The selected new Golden scene `decor-preview-handoff-1080` is captured and
visually inspected: one current furniture preview, no former-position ghost.
Its initial PNG SHA256 is
`342171da73f704f7d7180487d920422e3c81612b609df9cb913f995c22e5ba6b`.
The absent baseline is declared `new` in the ledger; no baseline is accepted.

## Risks and proof limits

Async order is covered by real full/live frames, cancellation and old frame
identity. Data/rights use unchanged writers and saved-object/history negatives.
Geometry and camera are read through existing coordinates; no model/calibration
changes are made. Visual proof uses the pinned Chromium build; it does not
establish behaviour on a particular GPU/WebView. No new continuous observer,
animation loop, backend field, storage or migration is added. Input neighbours
cover mouse, touch cancellation and native capture loss.

`decor-preview-keeps-settled-footprint-1080` and
`decor-preview-keeps-lost-capture-draft-1080` are registered witnesses and checked
only with `node scripts/mutation-gate.mjs --check`; they are **not executed**
during this work. Static applicability and ordinary PASS are not a caught claim.
