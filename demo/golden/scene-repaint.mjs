/** Invalidate proven raster-history artefacts only in explicitly scoped scenes. */
export async function captureGoldenFrame(page, scenario, screenshotOptions) {
  // #881 and the editor frames reproduce retained-paint history, including
  // #1118's exact prior CI geometry frame. Extra rAFs alone do not invalidate it.
  if (['device-battery-zigbee-overlap-dark', 'opening-placement-door-thick-wall-dark',
    'opening-placement-passage-thick-wall-dark', 'opening-placement-passage-thick-wall-light',
    'plan-snap-line-gaps-dark', 'geometry-plan-editor-dark'].includes(scenario.id)) {
    await page.evaluate(async () => {
      const style = document.documentElement.style;
      const property = '--hp-golden-page-bg';
      const value = style.getPropertyValue(property);
      const priority = style.getPropertyPriority(property);
      const background = getComputedStyle(document.body).backgroundColor;
      const frame = () => new Promise((done) => requestAnimationFrame(done));
      // Two distinct colours ensure a real paint even if the original happens
      // to match the first one. No card/overlay/fixture state is changed.
      try {
        style.setProperty(property, background === 'rgb(1, 2, 3)'
          ? 'rgb(3, 2, 1)' : 'rgb(1, 2, 3)', 'important');
        await frame();
        await frame();
      } finally {
        if (value) style.setProperty(property, value, priority);
        else style.removeProperty(property);
      }
      await frame();
      await frame();
    });
  }
  return page.screenshot(screenshotOptions);
}
