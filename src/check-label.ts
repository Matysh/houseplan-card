/** Shared activation for compact check rows with a genuine HA switch.
 * Browser label activation clicks the custom-element host, not its public
 * click() method. HA's click() delegates to its own native input. */
export function activateCheckLabel(event: Event): void {
  if (event.defaultPrevented) return;
  const path = event.composedPath();
  const label = path.find(node => node instanceof HTMLLabelElement
    && node.classList.contains('hpf-check')) as HTMLLabelElement | undefined;
  if (!label) return;
  const control = label.querySelector<HTMLElement & { disabled?: boolean }>('ha-switch');
  if (!control || path.includes(control) || label.control && label.control !== control) return;
  // Help, links and other independent actions retain their own activation.
  if (path.slice(0, path.indexOf(label)).some(node => node instanceof Element
    && node.matches('a,button,input,select,textarea,summary,hp-help,[role="button"],[role="link"],[contenteditable]:not([contenteditable="false"])'))) return;
  // Suppress the browser's additional custom-host click, including disabled
  // rows. The genuine switch owns focus, state, events and keyboard behavior.
  event.preventDefault();
  if (control.disabled || control.matches(':disabled') || label.closest('[inert]')) return;
  control.focus();
  control.click();
}
