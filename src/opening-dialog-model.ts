/** Detached opening dialog; nested Done never writes the parent configuration. */
import type { OpeningCfg, OpeningFeatures, OpeningHost, OpeningLeaf, WindowOpeningFeatures } from './types';
import { materializeWindowFeatures, windowOpeningFeatures } from './opening-features';

export interface OpeningDialogDraft {
  id?: string;
  type: OpeningCfg['type'];
  lengthCm: number;
  lengthTouched?: boolean;
  contact: string;
  lock: string;
  contactOpen?: boolean;
  contactFilter?: string;
  lockOpen?: boolean;
  lockFilter?: string;
  invert: boolean;
  lightTransparent?: boolean;
  flipH: boolean;
  flipV: boolean;
  host?: OpeningHost;
  x: number; y: number; angle: number;
  openingFeatures?: OpeningFeatures;
  featuresTouched?: boolean;
  editingLeaf?: { id: string; value: OpeningLeaf; dirty: boolean };
}

export function openingDraftObject(draft: OpeningDialogDraft): OpeningCfg {
  const explicitWindow = draft.type === 'window' && draft.openingFeatures && 'leaves' in draft.openingFeatures;
  return { id: draft.id || 'preview', type: draft.type, x: draft.x, y: draft.y, angle: draft.angle,
    length: draft.lengthCm,
    ...(draft.openingFeatures ? { opening_features: structuredClone(draft.openingFeatures) } : {}),
    ...(!explicitWindow ? { contact: draft.contact || null, invert: draft.invert,
      flip_h: draft.flipH, flip_v: draft.flipV } : {}),
  };
}

export function draftWindowFeatures(draft: OpeningDialogDraft): WindowOpeningFeatures {
  const opening = openingDraftObject(draft);
  let serial = 0;
  const current = windowOpeningFeatures(opening);
  return structuredClone(current || materializeWindowFeatures(opening, () => `initial-${serial++}`).opening_features) as WindowOpeningFeatures;
}

export function acceptOpeningLeafDraft(draft: OpeningDialogDraft): OpeningDialogDraft {
  const editing = draft.editingLeaf;
  const result = { ...draft, editingLeaf: undefined };
  if (!editing?.dirty) return result;
  const features = draftWindowFeatures(draft);
  const index = features.leaves.findIndex(leaf => leaf.id === editing.id);
  if (index < 0) return result; // Retired draft cannot resurrect a removed leaf.
  features.leaves[index] = structuredClone(editing.value);
  return { ...result, openingFeatures: features, featuresTouched: true };
}
