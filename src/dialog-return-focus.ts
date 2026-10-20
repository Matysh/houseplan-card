/** Suppress only the automatic return focus, never keyboard focus in general. */
const pending = new WeakMap<HTMLElement, () => void>();
export function prepareDialogReturnFocus(opener: HTMLElement | null): void {
  if (!opener?.isConnected || opener.localName !== 'button') return;
  pending.get(opener)?.();
  const root = opener.getRootNode();
  const controller = new AbortController();
  const clear = () => {
    controller.abort();
    opener.classList.remove('hp-dialog-return-focus');
    pending.delete(opener);
  };
  opener.classList.add('hp-dialog-return-focus');
  pending.set(opener, clear);
  const options = { capture: true, signal: controller.signal };
  root.addEventListener('keydown', clear, options);
  root.addEventListener('pointerdown', clear, options);
  opener.addEventListener('blur', clear, { signal: controller.signal });
}
