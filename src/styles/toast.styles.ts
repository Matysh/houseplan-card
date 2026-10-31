import {css} from 'lit';

// Both root and actual modal descendants use the same visual surface.
export const toastStyles = css`
  .toast {
    position: fixed;
    pointer-events: none;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    z-index: 120;
    max-width: 90vw;
  }
  .toast-portal { position: relative; }
  .toast-portal .toast {
    position: absolute;
    bottom: calc(100% + 8px);
    width: max-content;
    max-width: min(90vw, 100%);
    max-height: 50dvh;
    overflow-y: auto;
    pointer-events: auto;
  }
`;
