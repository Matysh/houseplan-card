import { css, unsafeCSS } from 'lit';
import { settingsActionsCss } from './styles/settings-action.styles';
import { floatingSurfaceCss } from './styles/floating-surface.styles';
import { editorFormKitCss, editorTilesCss } from './styles/form-kit-editor.styles';

/** Styles owned by the contextual editor surface.
 *
 * Kept separate from the card chrome so future submenu work does not grow the
 * global stylesheet again. Selectors intentionally target the existing light
 * DOM: extracting the styles must not alter layout or smoke-test hooks.
 */
const editorSecondaryBase = css`
  /* Contextual editor controls float over the stage. Their appearance must
     never alter stage height, viewport fitting or the pinned close action. */
  .editor-secondary-host {
    position: absolute;
    inset: var(--sp-2) var(--sp-4) auto;
    z-index: 70;
    display: flex;
    justify-content: flex-end;
    pointer-events: none;
  }
  .editor-secondary-host.kind-palette,
  .editor-secondary-host.kind-group {
    justify-content: flex-start;
  }
  .editor-secondary {
    pointer-events: none;
    max-width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    opacity: 0;
    visibility: hidden;
    transition:
      opacity var(--hpf-leave-duration,140ms) var(--hpf-leave-easing,ease),
      visibility 0s linear var(--hpf-leave-duration,140ms);
    touch-action: auto;
  }
  .editor-secondary-host.open .editor-secondary {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transition-duration: var(--hpf-appear-duration,180ms), 0s;
    transition-delay: 0s;
  }
  .editor-secondary-host.blocked .editor-secondary { pointer-events: none; }
  .editor-secondary-content,
  .editor-group-items {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .editor-context-label {
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-inline-end: var(--sp-4);
  }
  .editor-secondary[data-layout=actions] {
    display:grid; align-items:stretch; gap:12px; width:352px; max-width:100%;
    box-sizing:border-box;
  }
  .editor-secondary[data-layout=actions] .editor-context-label {
    display:block; max-width:none; padding:0; border:0;
  }
  .editor-secondary[data-layout=actions] .editor-secondary-content { display:block; overflow:visible; width:100%; }
  .editor-secondary-content > .decor-selection-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; width:100%; min-width:0; }
  .editor-secondary.kind-palette {
    width: min(760px, 100%);
    align-items: stretch;
    overflow: hidden;
  }
  .editor-secondary.kind-palette .editor-secondary-content,
  .editor-secondary.kind-palette .furnpalette {
    width: 100%;
  }
  .editor-secondary.kind-palette .furnpalette {
    max-height: 38vh;
    border: 0;
    background: transparent;
  }

  .editor-secondary .bdhint { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .editor-secondary .dfill { display:inline-flex; align-items:center; gap:var(--sp-2); }
  .editor-secondary hp-color-opacity { flex:0 0 auto; }
  .editor-secondary .drawwall { display:inline-flex; align-items:center; gap:var(--sp-3); white-space:nowrap; }
  @container (min-width: 560px) and (max-width: 899px) {
    .editor-secondary-content,
    .editor-group-items {
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }
  @container (max-width: 559px) {
    .editor-secondary-host { inset-inline: var(--sp-4); }
    .editor-secondary { max-width: 100%; }
    .editor-secondary-content,
    .editor-group-items {
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .editor-secondary-content > *,
    .editor-group-items > * { flex: none; }
    .editor-context-label { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .editor-secondary { transition: none; }
  }
`;

export const editorSecondaryStyles = unsafeCSS(editorSecondaryBase.cssText + editorFormKitCss
  + floatingSurfaceCss('.editor-secondary', '6px 8px')
  + floatingSurfaceCss('.editor-secondary[data-layout=actions]', '16px')
  + floatingSurfaceCss('.editor-secondary.kind-palette', '0')
  + editorTilesCss('.furnitem')
  + editorTilesCss('.furnitem.furncategory', 'category')
  + editorTilesCss('.imageasset .furnitem', 'asset')
  + settingsActionsCss('.editor-secondary .decor-selection-actions .btn'));
