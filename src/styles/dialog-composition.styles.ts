/** Composition contracts for the existing dialog form kit (#1007).
 * A section owns its separator; controls only own their internal layout.
 * Reused verbatim in the editor, embedded provider root and demo gallery.
 */
import { css } from 'lit';
import { controlReducedMotionCss } from './ui-motion.styles';

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
.hpf-sections-plain > .hpf-section:not([hidden]) ~ .hpf-section:not([hidden]) {
  padding-block-start:0; border-block-start:0;
}
.hpf-section > .hpf-sub h4 { margin:0; }
.hpf-action-help { display:inline-flex; align-items:center; gap:var(--hpf-help-gap,4px); min-width:0; max-width:100%; }
.hpf-action-help > hp-help { flex:none; }
.hpf-disclosure { min-width:0; }
.hpf-disclosure > summary {
  box-sizing:border-box; width:fit-content; max-width:100%; min-height:44px;
  cursor:pointer; overflow-wrap:anywhere; display:flex; align-items:center; gap:10px;
  list-style:none; transition:color var(--hpf-paint-duration,160ms) var(--hpf-paint-easing,ease);
}
.hpf-disclosure > summary::-webkit-details-marker { display:none; }
.hpf-disclosure > summary::marker { content:''; }
.hpf-disclosure > summary::before { content:''; display:block; flex:0 0 8px; width:8px; height:10px; background:currentColor; clip-path:polygon(0 0,0 100%,100% 50%); transform:rotate(0deg); transition:transform var(--hpf-disclosure-duration,220ms) var(--hpf-disclosure-easing,cubic-bezier(.2,0,.2,1)); }
.hpf-disclosure[data-expanded=true] > summary::before { transform:rotate(90deg); }
.hpf-disclosure > summary:not(.btn) { padding:10px 0; color:var(--hpf-accent,var(--primary-color)); font:inherit; line-height:22px; }
.hpf-disclosure > summary:not(.btn):is(:hover,:focus-visible) { color:var(--primary-text-color); }
.hpf-disclosure > summary:not(.btn):focus-visible { outline:2px solid var(--hpf-accent,var(--primary-color)); outline-offset:2px; border-radius:3px; }
.hpf-disclosure-content { box-sizing:border-box; min-width:0; min-height:0; }
.hpf-disclosure-inner { display:grid; gap:var(--hpf-group-space,12px); min-width:0; padding-block:var(--hpf-group-space,12px) 0; }
.hpf-disclosure-with-help { display:grid; grid-template-columns:minmax(0,max-content) auto; align-items:center; column-gap:var(--hpf-help-gap,4px); min-width:0; }
.hpf-disclosure-with-help > details { display:contents; }
.hpf-disclosure-with-help > details::details-content { display:contents; }
.hpf-disclosure-with-help > details > summary { grid-area:1/1; }
.hpf-disclosure-with-help > hp-help { grid-area:1/2; justify-self:start; }
.hpf-disclosure-with-help .hpf-disclosure-content { grid-column:1/-1; }
.hpf-disclosure-with-help > details:not([open]) > .hpf-disclosure-content { display:none; }
    /* Stable destructive/commit footer contract.  A flex spacer cannot react
       when translated labels no longer fit: justify-content then overflows
       the destructive button through the left inset.  Two real groups wrap
       as units instead — destructive actions stay left, while Cancel/Save
       move together to a right-aligned second row when necessary. */
    hp-dialog .row.dialog-action-footer {
      align-items: center;
      justify-content: flex-start;
      flex-wrap: wrap;
      row-gap: var(--sp-4);
    }
    hp-dialog .dialog-action-group {
      display: flex;
      flex: 0 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-4);
      max-width: 100%;
      min-width: 0;
    }
    hp-dialog .dialog-action-group .btn {
      flex: 0 0 auto;
      min-height: 44px;
    }
    hp-dialog .dialog-action-danger {
      margin-right: auto;
    }
    hp-dialog .dialog-action-commit {
      margin-left: auto;
      justify-content: flex-end;
    }
    /* #602: all four Space actions are one visual row.  Validation occupies a
       separate row without changing the order of the actions themselves. */
    hp-dialog .hpf-footer-space {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      align-items: center;
      column-gap: var(--sp-3);
      row-gap: var(--sp-2);
    }
    hp-dialog .hpf-footer-space .dialog-action-copy { grid-column: 1; grid-row: 2; }
    hp-dialog .hpf-footer-space .dialog-action-danger { grid-column: 2; grid-row: 2; margin-right: 0; }
    hp-dialog .hpf-footer-space .hpf-status { grid-column: 1 / -1; grid-row: 1; margin-left: 0; }
    hp-dialog .hpf-footer-space .hpf-status:empty { display: none; }
    hp-dialog .hpf-footer-space .dialog-action-commit { grid-column: 4; grid-row: 2; margin-left: 0; flex-wrap: nowrap; }
    hp-dialog .danger-confirm-footer .dialog-action-commit { flex-wrap: nowrap; }
    hp-dialog .danger-confirm-footer .btn { min-width: 0; white-space: normal; }
    @media (max-width: 480px) {
      hp-dialog .hpf-footer-space {
        grid-template-columns: 44px 44px minmax(0, 1fr) auto;
        column-gap: 6px;
        padding: var(--sp-4);
      }
      hp-dialog .hpf-footer-space .dialog-action-group { flex-wrap: nowrap; gap: 6px; }
      hp-dialog .hpf-footer-space .hpf-mobile-icon {
        box-sizing: border-box;
        width: 44px;
        min-width: 44px;
        padding-inline: 0;
        justify-content: center;
      }
      hp-dialog .hpf-footer-space .hpf-mobile-icon .hpf-action-label { display: none; }
      hp-dialog .hpf-footer-space .dialog-action-commit .btn {
        min-width: 0;
        padding-inline: 8px;
        white-space: normal;
      }
      hp-dialog .danger-confirm-footer .dialog-action-commit {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        margin-left: 0;
      }
      hp-dialog .danger-confirm-footer .dialog-action-commit .btn {
        width: 100%;
        padding-inline: 8px;
        line-height: 1.25;
      }
    }

`.cssText + controlReducedMotionCss('.hpf-disclosure > summary,.hpf-disclosure > summary::before');
