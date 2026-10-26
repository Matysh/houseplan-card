/** A fresh dialog owns its list response; replaced sessions cannot adopt it. */
import type { SpaceDialogState } from '../space-dialog';

interface PlanListHost {
  _spaceDialog: SpaceDialogState | null;
  hass: { callWS(message: { type: string }): Promise<unknown> };
}
const requests = new WeakMap<object, object>();

export function loadSpacePlanList(host: PlanListHost): void {
  const draft = host._spaceDialog;
  if (!draft) return;
  const token = {};
  requests.set(host, token);
  host._spaceDialog = { ...draft, saved: null, savedBusy: true };
  const accept = (saved: SpaceDialogState['saved']) => {
    const current = host._spaceDialog;
    if (requests.get(host) === token && current?.mode === draft.mode && current.spaceId === draft.spaceId)
      host._spaceDialog = { ...current, saved: saved || [], savedBusy: false };
  };
  void host.hass.callWS({ type: 'houseplan/plans/list' }).then(result => {
    const plans = (result as { plans?: SpaceDialogState['saved'] } | null)?.plans;
    accept(Array.isArray(plans) ? plans : []);
  }, () => accept([]));
}
