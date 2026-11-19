/** Standalone functions: injected unchanged into browser-only test harnesses. */
export function testSurfaceReady(card, expected = 'view', allowEmpty = false) {
  const root = card?.renderRoot?.querySelector('ha-card');
  if (!root || card._mode !== expected || card._booting
      || card._floorPreparation?.pending || card._floorPendingMode
      || card._modeTransitionBusy || card._modeTransitionPreparing
      || root.hasAttribute('data-hp-floor-cache')
      || root.querySelector('[data-hp-floor-cache]')) return false;
  const state = root.getAttribute('data-hp-state');
  if (state !== null && state !== 'ready') return false;
  const empty = allowEmpty && expected === 'view' && card._model?.length === 0
    && !!root.querySelector('[data-hp="empty"]');
  if (empty) return true;
  if (!card._loadOk) return false;
  const stage = root.querySelector(`.stage.mode-${expected}`);
  return !!stage && !stage.inert;
}

export function renderedIsoReady(card) {
  const root = card?.renderRoot;
  const stage = root?.querySelector('.stage');
  const rawCount = stage?.getAttribute('data-hp-iso-structural-builds');
  const count = rawCount === null || rawCount === undefined ? NaN : Number(rawCount);
  const walls = root?.querySelector('[data-hp="iso-walls"][data-fingerprint]');
  const queue = walls?.querySelector('.iso-wall-depth-queue');
  const faces = queue?.querySelectorAll('path.iso-wall-top, path.iso-wall-side, path[data-hp-round-column]');
  const bounds = queue?.getBBox();
  // Worker/cache hits legitimately build zero structures in the main thread.
  // Require painted masonry instead of forcing synchronous work for a counter.
  return stage?.getAttribute('data-hp-iso-stage') === '4'
    && stage.getAttribute('data-hp-iso-readiness') === 'ready'
    && Number.isSafeInteger(count) && count >= 0
    && !!walls?.getAttribute('data-fingerprint')?.trim()
    && !!faces?.length && [...faces].every(face => !!face.getAttribute('d')?.trim())
    && Number.isFinite(bounds?.width) && bounds.width > 0
    && Number.isFinite(bounds?.height) && bounds.height > 0;
}

/** The floor-anchored devices, locks and labels share the raised wall cut (#1474). */
export function raisedIsoOverlaysReady(card) {
  const root=card?.renderRoot;
  if(root?.querySelector('.stage')?.getAttribute('data-hp-iso-floor-markers')!=='true')return false;
  const rise = 140 * card._gridPitch / card._cellCm * Math.sin(50 * Math.PI / 180);
  if (!Number.isFinite(rise) || rise <= 0) return false;
  const nodes=root.querySelectorAll('[data-hp-iso-overlay-kind][data-hp-iso-floor][data-hp-iso-visual]');
  return nodes.length>0 && [...nodes].every(node=>{
    const floor=node.getAttribute('data-hp-iso-floor')?.split(',').map(Number);
    const visual=node.getAttribute('data-hp-iso-visual')?.split(',').map(Number);
    return floor?.length===2 && visual?.length===2
      && [...floor,...visual].every(Number.isFinite)
      && Math.abs(floor[0]-visual[0])<=1e-6 && Math.abs(floor[1]-visual[1]-rise)<=1e-6
      && node.getAttribute('data-hp-iso-nudged')==='false';
  });
}
