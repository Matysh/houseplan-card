import { css } from 'lit';

/** Styles owned by the contextual editor surface.
 *
 * Kept separate from the card chrome so future submenu work does not grow the
 * global stylesheet again. Selectors intentionally target the existing light
 * DOM: extracting the styles must not alter layout or smoke-test hooks.
 */
export const editorSecondaryStyles = css`
  :host {
    --hp-editor-tray-bg-fallback: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 94%, var(--hp-line));
    --hp-editor-tray-bg: color-mix(in srgb, var(--card-background-color, var(--hp-bg)) 86%, transparent);
    --hp-editor-tray-border: color-mix(in srgb, var(--hp-line) 82%, var(--hp-accent));
    --hp-editor-tray-blur: 8px;
    --hp-editor-tray-shadow: var(--shadow-2);
  }

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
    padding: var(--sp-3) var(--sp-4);
    color: var(--hp-txt);
    background: var(--card-background-color, var(--hp-bg));
    background: var(--hp-editor-tray-bg-fallback);
    border: 1px solid var(--hp-line);
    border-color: var(--hp-editor-tray-border);
    border-radius: var(--rad-l);
    box-shadow: var(--hp-editor-tray-shadow);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition:
      opacity 0.1s ease,
      transform 0.1s cubic-bezier(0.2, 0.7, 0.2, 1),
      visibility 0s linear 0.1s;
    touch-action: auto;
  }
  .editor-secondary-host.open .editor-secondary {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition-duration: 0.14s, 0.14s, 0s;
    transition-delay: 0s;
  }
  .editor-secondary-host.blocked .editor-secondary { pointer-events: none; }
  @supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .editor-secondary {
      background: var(--hp-editor-tray-bg);
      -webkit-backdrop-filter: blur(var(--hp-editor-tray-blur));
      backdrop-filter: blur(var(--hp-editor-tray-blur));
    }
  }
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
    border-inline-end: 1px solid var(--hp-line);
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }
  .editor-secondary.kind-palette {
    width: min(760px, 100%);
    align-items: stretch;
    padding: 0;
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
  .editor-group-launcher .group-chevron {
    --mdc-icon-size: 16px;
    transition: transform 0.14s ease;
  }
  .editor-group-launcher[aria-expanded="true"] .group-chevron { transform: rotate(180deg); }

  .editor-secondary .bdhint {
    font-size: var(--fs-s);
    color: var(--hp-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .editor-secondary .dfill {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: var(--fs-s);
    cursor: pointer;
  }
  .editor-secondary .dfill input[type="checkbox"] {
    width: 16px;
    height: 16px;
    flex: none;
    margin: 0;
    padding: 0;
  }
  .editor-secondary hp-color-opacity { flex: 0 0 auto; }
  .editor-secondary input {
    width: 74px;
    background: transparent;
    border: 1px solid var(--hp-line);
    color: var(--hp-txt);
    border-radius: var(--rad-s);
    padding: var(--sp-3) var(--sp-4);
    font-size: var(--fs-m);
  }
  .editor-secondary label,
  .editor-secondary .hint {
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }
  .editor-secondary .drawwall {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    white-space: nowrap;
  }
  .editor-secondary .drawwall input { width: 4.2em; }
  .editor-secondary .drawwall .opl {
    color: var(--hp-muted);
    font-size: var(--fs-s);
  }

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
    .editor-group-launcher .group-chevron { transition: none; }
  }
`;
