/** Composition contracts for the existing dialog form kit (#1007).
 * A section owns its separator; controls only own their internal layout.
 * Reused verbatim in the editor, embedded provider root and demo gallery.
 */
import { css } from 'lit';

export const dialogCompositionCss = css`
.hpf-settings-form {
  --hpf-section-space:18px;
  --hpf-group-space:12px;
  --hpf-help-gap:4px;
  --hpf-action-height:44px;
  --hpf-action-radius:7px;
}
.hpf-sections { display:grid; gap:0; min-width:0; }
.hpf-section { display:grid; gap:var(--hpf-group-space,12px); min-width:0; margin:0; padding:0; }
.hpf-section[hidden] { display:none!important; }
.hpf-section:not([hidden]) ~ .hpf-section:not([hidden]) {
  margin-block-start:var(--hpf-section-space,18px);
  padding-block-start:var(--hpf-section-space,18px);
  border-block-start:1px solid var(--hpf-line,var(--divider-color));
}
.hpf-section > .hpf-sub { margin:0; min-height:0; }
.hpf-section > .hpf-sub h4 { margin:0; }
.hpf-action-help { display:inline-flex; align-items:center; gap:var(--hpf-help-gap,4px); min-width:0; max-width:100%; }
.hpf-action-help > hp-help { flex:none; }
.hpf-disclosure { min-width:0; }
.hpf-disclosure > summary {
  box-sizing:border-box; width:fit-content; max-width:100%; min-height:44px;
  padding:10px 0; color:var(--hpf-accent,var(--primary-color)); cursor:pointer;
  font:inherit; line-height:22px; overflow-wrap:anywhere;
  transition:var(--hpf-disclosure-transition,color 160ms ease);
}
.hpf-disclosure > summary:is(:hover,:focus-visible) { color:var(--primary-text-color); }
.hpf-disclosure > summary:focus-visible { outline:2px solid var(--hpf-accent,var(--primary-color)); outline-offset:2px; border-radius:3px; }
.hpf-disclosure-compact { --hpf-disclosure-transition:background 160ms ease; }
.hpf-disclosure.hpf-disclosure-compact > summary { font-size:12px; line-height:1.45; color:var(--secondary-text-color); }
.hpf-disclosure.hpf-disclosure-compact > summary:is(:hover,:focus-visible) { background:var(--hpf-tint); }
.hpf-disclosure-content { display:grid; gap:var(--hpf-group-space,12px); min-width:0; padding-block:var(--hpf-group-space,12px) 0; }
.hpf-disclosure[open] > .hpf-disclosure-content { animation:hpf-disclosure-enter 160ms ease; }
.hpf-disclosure-with-help { display:grid; grid-template-columns:minmax(0,max-content) auto; align-items:center; column-gap:var(--hpf-help-gap,4px); min-width:0; }
.hpf-disclosure-with-help > details { display:contents; }
.hpf-disclosure-with-help > details::details-content { display:contents; }
.hpf-disclosure-with-help > details > summary { grid-area:1/1; }
.hpf-disclosure-with-help > hp-help { grid-area:1/2; justify-self:start; }
.hpf-disclosure-with-help .hpf-disclosure-content { grid-column:1/-1; }
.hpf-disclosure-with-help > details:not([open]) > .hpf-disclosure-content { display:none; }
@keyframes hpf-disclosure-enter { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:none; } }
@media(prefers-reduced-motion:reduce) {
  .hpf-disclosure > summary { transition:none; }
  .hpf-disclosure[open] > .hpf-disclosure-content { animation:none; }
}
`.cssText;
