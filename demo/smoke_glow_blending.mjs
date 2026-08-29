/** Browser pixel smoke for the isolated additive group (#19). */
import { readFileSync } from 'node:fs';
import { launch } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/glow/additive-pools.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1100, height: 820 });
try {
  const out = await page.evaluate(async (fixture) => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const until = async (predicate, timeout = 10000, label = 'condition') => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error(`Glow blending smoke timed out: ${label}`);
        await wait(15);
      }
    };
    const base = window.__card.hass;
    const connection = { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined };
    const hass = {
      ...base,
      language: 'en', locale: { language: 'en' }, user: { id: 'smoke', is_admin: true },
      devices: fixture.ha.devices, entities: fixture.ha.entities,
      areas: fixture.ha.areas, states: fixture.ha.states, floors: {}, connection,
      callWS: async (message) => {
        if (message.type === 'houseplan/config/get') return { config: structuredClone(fixture.config), rev: 1, can_write: true };
        if (message.type === 'houseplan/layout/get') return { layout: structuredClone(fixture.layout), rev: 1 };
        if (message.type === 'config/device_registry/list') return Object.values(fixture.ha.devices);
        if (message.type === 'config/entity_registry/list') return Object.values(fixture.ha.entities);
        if (message.type === 'config_entries/get') return [{ entry_id: 'glow_fixture', domain: 'houseplan_fixture', title: 'Glow fixture' }];
        if (message.type === 'manifest/list') return [{ domain: 'houseplan_fixture', name: 'Glow fixture' }];
        return { ok: true };
      },
      callService: async () => undefined, localize: () => null,
      formatEntityState: (state) => state.state,
      config: { unit_system: { length: 'km' } },
    };
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card' });
    document.getElementById('host').replaceChildren(card);
    card.hass = hass;
    try {
      await until(() => card._loadOk && card._devices?.length === 60, 10000, 'fixture load');
    } catch (error) {
      throw new Error(`${error.message}; loadOk=${card._loadOk}; model=${card._model?.length}; devices=${card._devices?.length}; error=${card._error || ''}`);
    }
    await until(() => card._glowScreenBlend === true, 3000, `screen probe (${card._glowScreenBlend})`);
    await card.updateComplete;
    await frame();
    const poolGroup = card.renderRoot.querySelector('.glow-pools');

    const raster = async (
      reverse, screen,
      a = [224, 80, 32], b = [32, 112, 224], bg = [20, 30, 40],
    ) => {
      const shapes = reverse
        ? `<rect x="1" width="2" height="1" fill="url(#pool-b)" style="mix-blend-mode:${screen ? 'screen' : 'normal'}"/><rect x="0" width="2" height="1" fill="url(#pool-a)" style="mix-blend-mode:${screen ? 'screen' : 'normal'}"/>`
        : `<rect x="0" width="2" height="1" fill="url(#pool-a)" style="mix-blend-mode:${screen ? 'screen' : 'normal'}"/><rect x="1" width="2" height="1" fill="url(#pool-b)" style="mix-blend-mode:${screen ? 'screen' : 'normal'}"/>`;
      const source = `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="1"><defs><linearGradient id="pool-a"><stop stop-color="rgb(${a})" stop-opacity="0.7"/></linearGradient><linearGradient id="pool-b"><stop stop-color="rgb(${b})" stop-opacity="0.7"/></linearGradient></defs><rect width="4" height="1" fill="rgb(${bg})"/><path d="M3 0H4V1H3Z" fill="#6a7b8c"/><g style="isolation:isolate"><g style="isolation:isolate">${shapes}</g></g></svg>`;
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
      try {
        const image = await new Promise((resolve, reject) => {
          const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = url;
        });
        const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        return [...context.getImageData(0, 0, 4, 1).data];
      } finally { URL.revokeObjectURL(url); }
    };
    const forward = await raster(false, true);
    const reverse = await raster(true, true);
    const fallback = await raster(false, false);
    const sameDim = await raster(false, true, [72, 88, 104], [72, 88, 104]);
    const fullBase = card.renderRoot.querySelector('.glow-base-layer .glow-base');
    const dataTunnel = card.renderRoot.querySelector('.opening-tunnels[data-layer="data"]');
    const baseTunnel = card.renderRoot.querySelector('.opening-tunnels[data-layer="glow-base"]');
    const poolFrame = card.renderRoot.querySelector('.glow-pools-frame');
    const follows = (left, right) => !!left && !!right
      && !!(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
    // Each source is limited to the floor its own lamp can see; that region is
    // a luminance mask on the inner group, so the spot itself stays a single
    // screen-blended primitive.
    const clippedPools = [...card.renderRoot.querySelectorAll('.glow-pool')]
      .filter((pool) => pool.hasAttribute('clip-path')).length;

    await customElements.whenDefined('houseplan-space-card');
    const staticOffCard = document.createElement('houseplan-space-card');
    staticOffCard.setConfig({
      type: 'custom:houseplan-space-card', space: fixture.config.spaces[0].id,
      show_button: false,
    });
    staticOffCard.hass = hass;
    document.body.appendChild(staticOffCard);
    await until(() => staticOffCard.renderRoot?.querySelector('.hp-static-stage'));
    await staticOffCard.updateComplete;
    const staticBase = staticOffCard.renderRoot.querySelector('.glow-base-layer .glow-base');
    const staticOffPools = staticOffCard.renderRoot.querySelectorAll('.glow-pool, .glowlayer').length;
    const baseParity = !!fullBase && !!staticBase
      && fullBase.getAttribute('fill') === staticBase.getAttribute('fill')
      && fullBase.getAttribute('fill-opacity') === staticBase.getAttribute('fill-opacity');

    const staticCard = document.createElement('houseplan-space-card');
    staticCard.setConfig({
      type: 'custom:houseplan-space-card', space: fixture.config.spaces[0].id,
      show_button: false, light_pools: true,
    });
    staticCard.hass = hass;
    document.body.appendChild(staticCard);
    await until(() => staticCard.renderRoot?.querySelector('.hp-static-stage'));
    await until(() => staticCard._glowScreenBlend === true, 3000, 'static screen probe');
    await until(() => staticCard.renderRoot.querySelectorAll('.glow-pool').length === 60,
      10000, 'static Glow pools');
    await staticCard.updateComplete;
    await frame();
    const staticPoolGroup = staticCard.renderRoot.querySelector('.glow-pools');
    const staticPoolNodes = [...staticCard.renderRoot.querySelectorAll('.glow-pool')];
    const staticClippedPools = staticPoolNodes.filter((pool) => pool.hasAttribute('clip-path')).length;
    const poolSnapshot = (root, pool) => {
      const clipId = pool?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/)?.[1] || '';
      const clip = [...root.querySelectorAll('clipPath')].find((node) => node.id === clipId);
      return {
        source: pool?.parentElement?.getAttribute('data-glow-source') || '',
        cx: pool?.getAttribute('cx') || '', cy: pool?.getAttribute('cy') || '',
        r: pool?.getAttribute('r') || '', parts: pool?.getAttribute('data-lit-parts') || '',
        lit: [...(clip?.querySelectorAll('.glow-lit') || [])].map((path) => path.getAttribute('d') || ''),
      };
    };
    const fullFirst = poolSnapshot(card.renderRoot, card.renderRoot.querySelector('.glow-pool'));
    const staticFirst = poolSnapshot(staticCard.renderRoot, staticPoolNodes[0]);
    const staticPointerEvents = getComputedStyle(
      staticCard.renderRoot.querySelector('.hp-static-stage'),
    ).pointerEvents;
    staticOffCard.remove();
    staticCard.remove();

    // The fixture deliberately has Temperature mode without temperature
    // entities, which verifies the Glow fallback above. Now switch the same
    // mounted plan to a real data fill and verify that the base disappears
    // without changing the data colour/alpha or its layer order.
    const spaceCfg = card._serverCfg.spaces[0];
    spaceCfg.settings = {
      ...(spaceCfg.settings || {}),
      fill_mode: 'custom', custom_fill: { c: '#486a8f', a: 0.42 },
    };
    card._cfgEpoch++;
    card.requestUpdate();
    await card.updateComplete;
    await frame();
    const customRoom = card.renderRoot.querySelector('.room.filled');
    const customDataTunnel = card.renderRoot.querySelector('.opening-tunnels[data-layer="data"]');
    const customPoolFrame = card.renderRoot.querySelector('.glow-pools-frame');
    const customBase = card.renderRoot.querySelector('.glow-base-layer .glow-base');
    const customBaseTunnel = card.renderRoot.querySelector('.opening-tunnels[data-layer="glow-base"]');
    return {
      blend: poolGroup?.getAttribute('data-blend'),
      poolFrameHasOpacity: poolFrame?.hasAttribute('opacity'),
      pools: card.renderRoot.querySelectorAll('.glow-pool').length,
      clippedPools,
      baseLayerOrder: follows(dataTunnel, fullBase)
        && follows(fullBase, baseTunnel) && follows(baseTunnel, poolFrame),
      fullBase: !!fullBase, baseTunnel: !!baseTunnel,
      staticBase: !!staticBase, staticOffPools, baseParity,
      staticPools: staticPoolNodes.length, staticClippedPools,
      staticBlend: staticPoolGroup?.getAttribute('data-blend'),
      staticPointerEvents, fullFirst, staticFirst,
      customFill: customRoom?.style.getPropertyValue('--room-fill'),
      customOpacity: customRoom?.style.getPropertyValue('--room-fill-op'),
      customBase: !!customBase, customBaseTunnel: !!customBaseTunnel,
      customLayerOrder: follows(customRoom, customDataTunnel)
        && follows(customDataTunnel, customPoolFrame),
      forward, reverse, fallback, sameDim,
    };
  }, fixture);
  const pixel = (data, index) => data.slice(index * 4, index * 4 + 4);
  const over = (fg, bg, alpha) => fg.map((value, index) => Math.round(value * alpha + bg[index] * (1 - alpha)));
  // Pools blend against the transparent backdrop of their isolated group,
  // then that group is composited over the room. Account for the backdrop
  // alpha here instead of treating the room itself as the blend backdrop.
  const isolatedScreenOver = (first, second, background, alpha) => {
    const outputAlpha = alpha + alpha * (1 - alpha);
    return first.map((backdrop, index) => {
      const source = second[index];
      const blended = 255 - ((255 - backdrop) * (255 - source)) / 255;
      const sourceColor = (1 - alpha) * source + alpha * blended;
      const groupPremultiplied = alpha * sourceColor + alpha * (1 - alpha) * backdrop;
      return Math.round(groupPremultiplied + background[index] * (1 - outputAlpha));
    });
  };
  const bg = [20, 30, 40];
  const expected = [...isolatedScreenOver([224, 80, 32], [32, 112, 224], bg, 0.7), 255];
  const expectedFallback = [...over([32, 112, 224], over([224, 80, 32], bg, 0.7), 0.7), 255];
  const close = (actual, wanted) => actual.every((value, index) => Math.abs(value - wanted[index]) <= 2);
  if (out.blend !== 'screen') throw new Error(`runtime probe did not enable screen: ${out.blend}`);
  if (out.poolFrameHasOpacity) throw new Error('Glow pool frame still applies a second opacity');
  if (out.pools !== 60) throw new Error(`expected 60 pools, got ${out.pools}`);
  if (!close(pixel(out.forward, 1), expected)) throw new Error(`screen pixel mismatch: ${pixel(out.forward, 1)} vs ${expected}`);
  if (!close(pixel(out.reverse, 1), expected)) throw new Error('screen result depends on marker order');
  if (!close(pixel(out.fallback, 1), expectedFallback)) throw new Error('normal fallback no longer matches baseline composition');
  const singleDim = pixel(out.sameDim, 0);
  const overlapDim = pixel(out.sameDim, 1);
  if (![0, 1, 2].every((index) => overlapDim[index] > singleDim[index] && overlapDim[index] < 255))
    throw new Error(`same-colour dim overlap did not brighten without clipping: ${singleDim} -> ${overlapDim}`);
  if (!close(pixel(out.forward, 3), [106, 123, 140, 255])) throw new Error('non-pool sector/background changed');
  if (out.clippedPools !== out.pools) throw new Error(`lost per-source clips: ${out.clippedPools}/${out.pools}`);
  if (!out.baseLayerOrder) throw new Error('data/base/tunnel/pool layer order changed');
  if (!out.fullBase || !out.baseTunnel || !out.staticBase || out.staticOffPools !== 0 || !out.baseParity)
    throw new Error(`missing-data Glow fallback/parity failed: full=${out.fullBase}, tunnel=${out.baseTunnel}, static=${out.staticBase}, offPools=${out.staticOffPools}, parity=${out.baseParity}`);
  if (out.staticPools !== out.pools || out.staticClippedPools !== out.staticPools)
    throw new Error(`static pools/clips differ: pools=${out.staticPools}/${out.pools}, clips=${out.staticClippedPools}`);
  if (out.staticBlend !== 'screen' || out.staticPointerEvents !== 'none')
    throw new Error(`static Glow composition changed: blend=${out.staticBlend}, pointer=${out.staticPointerEvents}`);
  if (JSON.stringify(out.staticFirst) !== JSON.stringify(out.fullFirst))
    throw new Error(`full/static source geometry differs: ${JSON.stringify(out.fullFirst)} vs ${JSON.stringify(out.staticFirst)}`);
  if (out.customFill !== '#486a8f' || Number(out.customOpacity) !== 0.42)
    throw new Error(`custom data fill changed: ${out.customFill}/${out.customOpacity}`);
  if (out.customBase || out.customBaseTunnel || !out.customLayerOrder)
    throw new Error(`data fill was tinted/reordered by Glow base: full=${out.customBase}, tunnel=${out.customBaseTunnel}, order=${out.customLayerOrder}`);
  console.log(JSON.stringify({ ok: true, blend: out.blend, pools: out.pools, staticParity: true, staticPools: out.staticPools }));
} finally {
  await browser.close();
}
