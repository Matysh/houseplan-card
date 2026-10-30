/** #1026 owned inputs; #1132 retires Off-only dimming, retaining whole unavailable paint. */
export async function prepareDeviceOfflineBoard(page) {
  return page.evaluate(async () => {
    const card = window.__goldenCard, root = card.renderRoot;
    const near = (actual, expected) => Number.isFinite(actual) && Math.abs(actual - expected) < .005;
    const face = id => root.querySelector(`.dev[data-id="offline-${id}"],.dev[data-led-badge="offline-${id}"]`);
    const opacity = node => node ? Number(getComputedStyle(node).opacity) : NaN;
    const effective = (node, marker) => {
      let value = 1;
      if (!node) return NaN;
      for (let at = node; at; at = at.parentElement) {
        value *= opacity(at); if (at === marker) break;
      }
      return value;
    };
    const records = [];
    for (const [id, offline] of [['icon', false], ['down', true], ['text', true],
      ['unknown', false], ['missing', false], ['source', false], ['double', true],
      ['static', false], ['controller', false], ['exact', true], ['alarm', true], ['legacy', false],
      ['whole', false], ['alarm-whole', false]]) {
      const marker = face(id), core = marker?.querySelector('.device-core');
      const glyph = core?.querySelector('ha-icon,.valtext');
      const powerOff = id === 'icon' || id === 'source';
      if (!marker || !core || !glyph) throw new Error(`offline board missing real face: ${id}`);
      await Promise.allSettled(marker.getAnimations({ subtree: true })
        .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
        .map(animation => animation.finished));
      if (marker.classList.contains('unavail') !== offline || !near(opacity(marker), offline ? .35 : 1)
        || !near(opacity(core), 1)
        || marker.classList.contains('power-off') !== powerOff
        || !near(effective(glyph, marker), offline ? .35 : 1)
        || (offline && !near(opacity(glyph), 1))) {
        throw new Error(`offline board wrong owned paint: ${id}`);
      }
      if (id === 'text' && (!glyph.matches('.valtext') || !glyph.textContent.includes('23.5')))
        throw new Error('offline board did not render the actual Text value');
      if (id === 'alarm' && !marker.classList.contains('alarm'))
        throw new Error('offline board lost a confirmed owned critical state source');
      if (id === 'legacy' && marker.querySelectorAll('.value-badge').length !== 2)
        throw new Error('offline board lost the real legacy second metric');
      if (glyph.matches('ha-icon')) {
        await glyph.updateComplete;
        if (!glyph.shadowRoot?.querySelector('path')?.getAttribute('d'))
          throw new Error(`offline board has no actual MDI glyph: ${id}`);
      }
      for (const badge of marker.querySelectorAll('.value-badge')) {
        const content = badge.querySelector('.value-badge-content');
        const expected = offline ? .35 : badge.classList.contains('unavailable') ? .66 : 1;
        if (!content || !near(effective(content, marker), expected)
          || (offline && !near(opacity(badge), 1)))
          throw new Error(`offline board fades badge shell or compounds reasons: ${id}`);
      }
      records.push({ id, offline, glyphOpacity: effective(glyph, marker) });
    }
    const down = face('down'), normal = face('icon');
    if (getComputedStyle(down.querySelector('.device-core')).backgroundColor
      !== getComputedStyle(normal.querySelector('.device-core')).backgroundColor)
      throw new Error('offline board has a replacement offline background');
    if (!near(effective(face('exact').querySelector('.device-battery'), face('exact')), .35))
      throw new Error('offline board does not dim the entire ordinary marker');
    for (const state of ['off', 'unavailable', 'unknown']) {
      const led = root.querySelector(`.led-strip[data-marker="offline-led-${state}"]`);
      const core = led?.querySelector('.led-core'), outline = led?.querySelector('.led-outline');
      if (led?.dataset.state !== 'off' || !core?.getAttribute('d') || !outline?.getAttribute('d')
        || getComputedStyle(core).stroke !== 'rgb(255, 255, 255)'
        || getComputedStyle(outline).stroke !== 'rgb(56, 56, 56)'
        || !near(Number(getComputedStyle(core).strokeOpacity), .7)
        || !led.querySelector('.led-body')?.getAttribute('mask')?.startsWith('url(#hp-led-off-')
        || !['none', '0px'].includes(getComputedStyle(core).strokeDasharray)
        || !['none', '0px'].includes(getComputedStyle(outline).strokeDasharray))
        throw new Error(`offline board fabricates an LED unavailable state: ${state}`);
    }
    const badgeOnly = face('led-unavailable'), badgeContent = badgeOnly?.querySelector('.value-badge-content');
    if (!near(effective(badgeContent, badgeOnly), .35))
      throw new Error('offline board loses LED badge-only indication');
    return { markers: records, leds: 3, actualText: true, wholeOrdinaryMarker: true, ledGeometryUnchanged: true };
  });
}
