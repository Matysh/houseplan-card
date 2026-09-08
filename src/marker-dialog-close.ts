interface MarkerDialogCloseHost<T extends { anchor?: string | null }> {
  _markerDialog: unknown | null;
  _deviceInboxReturn: T | null;
  _deviceInbox: T | null;
  updateComplete: Promise<unknown>;
  renderRoot: ParentNode;
}

export function finishMarkerDialogClose<T extends { anchor?: string | null }>(
  host: MarkerDialogCloseHost<T>,
): void {
  host._markerDialog = null;
  if (!host._deviceInboxReturn) return;
  const restored = { ...host._deviceInboxReturn } as T;
  host._deviceInbox = restored;
  host._deviceInboxReturn = null;
  if (!restored.anchor) return;
  void host.updateComplete.then(() => requestAnimationFrame(() => {
    const selector = `.device-inbox-row[data-binding="${CSS.escape(restored.anchor!)}"]`;
    host.renderRoot.querySelector<HTMLElement>(selector)?.scrollIntoView({ block: 'nearest' });
  }));
}
