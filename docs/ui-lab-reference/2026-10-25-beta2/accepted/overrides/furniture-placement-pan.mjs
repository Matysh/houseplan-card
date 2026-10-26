// Local experiment: mouse click stamps furniture; a drag uses the native camera.
export function installFurniturePlacementPan(card, enabled) {
  let pending = null;
  const patched = new WeakSet();
  const down = card._decorPointerDown;
  const move = card._stagePointerMove;
  const up = card._stagePointerUp;
  const cancel = card._stagePointerCancel;
  const valid = gesture => enabled() && card._mode === 'decor' && card._decorTool === 'furniture'
    && card._space === gesture.space && card._furnPalette === gesture.palette;
  const clear = () => {
    const gesture = pending;
    pending = null;
    gesture?.stage?.removeAttribute('data-lab-furniture-panning');
    return gesture;
  };
  card._decorPointerDown = function (event) {
    if (!enabled() || this._decorTool !== 'furniture' || !this._furnPalette
      || event.pointerType !== 'mouse' || event.button !== 0) return down.call(this, event);
    const runtime = this._editorRuntime;
    if (!patched.has(runtime)) {
      patched.add(runtime);
      const previewMove = runtime._furnPointerMove;
      runtime._furnPointerMove = function (ev, hover) {
        const result = previewMove.call(this, ev, hover);
        return pending?.id === ev.pointerId ? false : result;
      };
    }
    event.preventDefault();
    pending = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false,
      palette: this._furnPalette, space: this._space, stage: this._stageEl, last: event };
    try {
      pending.stage?.setPointerCapture(event.pointerId);
      pending.captured = !!pending.stage?.hasPointerCapture(event.pointerId);
    } catch { /* cancelled pointer */ }
    return false; // Let the existing stage seed its pan transaction.
  };
  card._stagePointerMove = function (event) {
    const gesture = pending?.id === event.pointerId ? pending : null;
    if (gesture?.captured && !gesture.stage.hasPointerCapture(event.pointerId)) {
      this._stagePointerCancel(event);
      return;
    }
    if (gesture) {
      gesture.last = event;
      gesture.moved ||= Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) > 8;
      if (gesture.moved) gesture.stage?.setAttribute('data-lab-furniture-panning', '');
    }
    const result = move.call(this, event);
    // Camera movement changes the pointer's world position. Refresh the ghost
    // after native viewport application so it stays attached to the cursor.
    if (gesture && valid(gesture) && this._panLock === 'pan') {
      this._editorRuntime._furnPointerMove(event, this._pointerModality.hoverEnabled);
    }
    return result;
  };
  card._stagePointerUp = function (event) {
    const gesture = pending?.id === event.pointerId ? clear() : null;
    const place = gesture && valid(gesture) && !gesture.moved && this._panLock !== 'pan'
      && (!gesture.captured || gesture.stage.hasPointerCapture(event.pointerId))
      && this._pointers.size <= 1
      && Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) <= 8;
    const result = up.call(this, event);
    if (place) this._editorRuntime._furnPlace(this._svgPoint(event), event.shiftKey, 'mouse');
    return result;
  };
  card._stagePointerCancel = function (event) {
    if (pending?.id === event.pointerId) clear();
    return cancel.call(this, event);
  };
  card.renderRoot.addEventListener('lostpointercapture', event => {
    if (pending?.id === event.pointerId) card._stagePointerCancel(event);
  }, true);
  window.addEventListener('blur', () => {
    if (pending) card._stagePointerCancel(pending.last);
  });
}
