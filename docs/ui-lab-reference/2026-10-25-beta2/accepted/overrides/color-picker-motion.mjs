// Shared local experiment for every hp-color-opacity consumer, including portals.
export function installColorPickerMotion(enabled) {
  void customElements.whenDefined('hp-color-opacity').then(Type => {
    const prototype = Type.prototype;
    const position = prototype._positionPicker;
    const close = prototype._closePicker;
    const toggle = prototype._toggle;
    const seen = new WeakSet();
    const motions = new WeakMap();
    const closing = new WeakMap();
    const reduced = picker => picker.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finishClose = (picker, args) => {
      const result = close.apply(picker, enabled() ? [false, args[1]] : args);
      // hidePopover may restore the trigger itself; clear that focus immediately.
      if (enabled()) picker.renderRoot.querySelector('.trigger')?.blur();
      return result;
    };
    prototype._positionPicker = function (...args) {
      const result = position.apply(this, args);
      const surface = result && this._surface();
      if (surface && !seen.has(surface)) {
        seen.add(surface);
        if (enabled() && !reduced(this)) {
          const offset = surface.dataset.side === 'top' ? 4 : -4;
          const animation = surface.animate([
            { opacity: 0, transform: `translateY(${offset}px)` },
            { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 160, easing: 'cubic-bezier(.2,.7,.2,1)' });
          motions.set(surface, animation);
        }
      }
      return result;
    };
    prototype._closePicker = function (...args) {
      // Escape must not leave an extra focus outline on the colour swatch.
      if (enabled()) this.renderRoot.querySelector('.trigger')?.blur();
      const pending = closing.get(this);
      if (pending) {
        if (args[1] === 'disconnect' || this.disabled || !this.isConnected) pending.finish();
        return;
      }
      const surface = this._surface();
      if (!enabled() || reduced(this) || !this._open || !surface?.isConnected
        || args[1] === 'disconnect' || this.disabled || !this.isConnected) return finishClose(this, args);
      const from = getComputedStyle(surface);
      const opacity = from.opacity, transform = from.transform;
      motions.get(surface)?.cancel();
      surface.inert = true;
      surface.style.pointerEvents = 'none';
      this._cancelQueuedEmit();
      this._activePointerId = null;
      const offset = surface.dataset.side === 'top' ? 4 : -4;
      const animation = surface.animate([
        { opacity, transform },
        { opacity: 0, transform: `translateY(${offset}px)` },
      ], { duration: 120, easing: 'ease-in', fill: 'forwards' });
      const state = { finish: () => {
        if (closing.get(this) !== state) return;
        closing.delete(this);
        finishClose(this, args);
        animation.cancel();
      } };
      closing.set(this, state);
      animation.finished.then(state.finish, state.finish);
    };
    prototype._toggle = async function (...args) {
      const pending = closing.get(this);
      if (pending) { pending.finish(); await this.updateComplete; }
      return toggle.apply(this, args);
    };
  });
}
