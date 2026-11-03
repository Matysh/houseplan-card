/** Reporter-only capture of the real browser HTTP reply to a large import.
 * Chromium's default inspector cache can evict a reply when its POST is >32MiB.
 * A separate bounded Network observer keeps the actual bytes; it never routes,
 * repeats, mocks, fulfils or changes the product request/response. */
export async function observeLargePreview(page, { timeout = 30_000 } = {}) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Network.enable', { maxTotalBufferSize: 128 * 1024 * 1024,
      maxResourceBufferSize: 64 * 1024 * 1024, maxPostDataSize: 0 });
  } catch (error) { await session.detach(); throw error; }
  const requests = [], preview = url => /^\/api\/houseplan\/(?:backup\/)?import\/preview$/.test(new URL(url).pathname);
  let resolve, reject, selected, finished = false, disposed = false;
  const response = new Promise((yes, no) => { resolve = yes; reject = no; });
  // The caller waits after native UI interaction; retain an early failure
  // without an unhandled rejection, while the original promise stays failed.
  response.catch(() => {});
  const fail = error => { if (!finished) { finished = true; reject(error); } };
  const timer = setTimeout(() => fail(Error('The real large-preview reply was not captured before timeout')), timeout);
  const onRequest = event => {
    if (event.request.method !== 'POST' || !preview(event.request.url)) return;
    requests.push({ requestId: event.requestId, url: event.request.url, method: event.request.method });
    if (requests.length !== 1) fail(Error('More than one real preview POST was observed'));
  };
  const onResponse = event => {
    if (!requests.some(request => request.requestId === event.requestId)) return;
    if (!preview(event.response.url) || selected) return fail(Error('Ambiguous large-preview response'));
    selected = { ...requests[0], status: event.response.status };
  };
  const onFailed = event => {
    if (requests.some(request => request.requestId === event.requestId)) fail(Error(`Large-preview HTTP failed: ${event.errorText}`));
  };
  const onFinished = async event => {
    if (!selected || event.requestId !== selected.requestId || finished) return;
    try {
      const body = await session.send('Network.getResponseBody', { requestId: event.requestId });
      const reply = JSON.parse(body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body);
      if (requests.length !== 1) throw Error('Large-preview request identity changed');
      finished = true; clearTimeout(timer); resolve({ ...selected, reply });
    } catch (error) { fail(error); }
  };
  session.on('Network.requestWillBeSent', onRequest);
  session.on('Network.responseReceived', onResponse);
  session.on('Network.loadingFailed', onFailed);
  session.on('Network.loadingFinished', onFinished);
  return { response, requests,
    async dispose() {
      if (disposed) return; disposed = true; clearTimeout(timer);
      fail(Error('Large-preview observation disposed before completion'));
      session.off('Network.requestWillBeSent', onRequest); session.off('Network.responseReceived', onResponse);
      session.off('Network.loadingFailed', onFailed); session.off('Network.loadingFinished', onFinished);
      await session.detach();
    },
  };
}
