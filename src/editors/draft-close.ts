import type { HpConfirmRequest } from '../danger-confirm';
import { dialogSession, type DialogKind } from './dialog-baseline';

export interface CloseSurface { rejectClose(): void }

/** The confirm owns a decision, never a later form that reused its DOM. */
export async function requestDraftClose(options: {
  host: object;
  kind: DialogKind;
  dirty: boolean;
  current(): boolean;
  confirm(request: HpConfirmRequest): Promise<boolean>;
  request: HpConfirmRequest;
  surface?: CloseSurface | null;
  close(): void;
}): Promise<boolean> {
  const owner = dialogSession(options.host, options.kind);
  const current = () => options.current()
    && dialogSession(options.host, options.kind) === owner;
  if (!current()) return false;
  if (!options.dirty) { options.close(); return true; }
  const discard = await options.confirm(options.request);
  if (!current()) return false;
  if (!discard) { options.surface?.rejectClose(); return false; }
  options.close();
  return true;
}

export function closeSurface(root: ParentNode, kind: DialogKind): CloseSurface | null {
  return root.querySelector<HTMLElement & CloseSurface>(`hp-dialog[data-kind="${kind}"]`);
}
