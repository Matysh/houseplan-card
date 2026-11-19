import { setTimeout as delay } from 'node:timers/promises';

/** A Chromium headless-shell target where each requested frame can return its
 * own pixels. Use this for visual evidence, outside timing benchmarks. */
export function controlledCompositor() {
  let protocol, pump, failure, sequence = 0, running = false, recording = null, inFlight;

  async function createPage(context, browser) {
    const seed = await context.newPage();
    const seedProtocol = await context.newCDPSession(seed);
    const { targetInfo } = await seedProtocol.send('Target.getTargetInfo');
    const root = await browser.newBrowserCDPSession();
    try {
      const pageReady = context.waitForEvent('page');
      await root.send('Target.createTarget', {
        url: 'about:blank', browserContextId: targetInfo.browserContextId, enableBeginFrameControl: true,
      });
      const page = await pageReady;
      protocol = await context.newCDPSession(page);
      await seed.close();
      running = true;
      page.once('close', () => { running = false; });
      pump = (async () => {
        while (running) {
          const frames = recording;
          const options = frames ? { screenshot: { format: 'png', optimizeForSpeed: true } } : {};
          const request = protocol.send('HeadlessExperimental.beginFrame', options).then(result => {
            sequence++;
            if (frames) frames.push({
              sequence, changed: result.hasDamage, readyAt: Date.now(),
              png: result.screenshotData ? Buffer.from(result.screenshotData, 'base64') : null,
            });
          });
          inFlight = request;
          await request;
          await delay(16);
        }
      })().catch(error => { failure = error; });
      return page;
    } finally {
      await root.detach();
    }
  }

  return {
    createPage,
    browserArgs: ['--run-all-compositor-stages-before-draw'],
    capture() {
      if (!running || recording) throw Error('Controlled compositor is unavailable or already recording');
      recording = [];
    },
    async take() {
      if (!recording) throw Error('No controlled frames were requested');
      const frames = recording;
      recording = null;
      await inFlight;
      if (failure) throw failure;
      if (!frames.some(frame => frame.png)
          || frames.some((frame, i) => (frame.changed && !frame.png)
            || (i > 0 && frame.sequence !== frames[i - 1].sequence + 1))) {
        throw Error('Controlled capture missed the image of an emitted frame');
      }
      return frames;
    },
    async stop() {
      running = false;
      await pump;
    },
  };
}
