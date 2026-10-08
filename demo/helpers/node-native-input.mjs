// Match Playwright's held-primary-button mouse protocol. Omitting `button`
// while supplying `buttons: 1` can release Chromium's native pointer capture.
export function sendNodeNativeMove(cdp, point) {
  return cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: point.x, y: point.y,
    button: 'left', buttons: 1, pointerType: 'mouse',
  });
}
