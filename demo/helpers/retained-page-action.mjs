/**
 * #967: evaluate() awaits promises through CDP, but that wait is not a GC root.
 * Keep the action in a plain object held by a public Playwright JSHandle and
 * observe its completed state; never return a pending promise through CDP.
 * evaluateHandle(action) alone would await the promise before returning a handle.
 *
 * Only self-contained, test-authored functions are accepted (the same boundary
 * as page.evaluate(action)); no user text or product state is changed here.
 */
export async function evaluateRetainedAction(page, action, label, timeoutMs = 20000) {
  if (typeof action !== 'function') throw new TypeError('A page action must be a function');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('A finite positive action deadline is required');
  const source = Function.prototype.toString.call(action);
  const holder = await page.evaluateHandle(`(() => {
    const state = {status:'pending'};
    state.promise = Promise.resolve((${source})());
    state.promise.then(
      value => {state.value = value; state.status = 'fulfilled';},
      error => {state.error = error; state.status = 'rejected';}
    );
    return state;
  })()`);
  try {
    let ready;
    try {
      ready = await page.waitForFunction(state => state.status !== 'pending', holder, {timeout:timeoutMs});
    } catch (error) {
      if (error.name === 'TimeoutError')
        throw new Error(`${label}: action did not complete within ${timeoutMs} ms`, {cause:error});
      throw error;
    }
    await ready.dispose();
    return await holder.evaluate(state => {
      if (state.status === 'rejected') throw state.error;
      return state.value;
    });
  } finally {
    await holder.dispose();
  }
}
