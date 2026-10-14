/** #881: invalidate raster history only for the owner's opted-in scene. */
export async function captureGoldenFrame(page, scenario, screenshotOptions) {
  if (scenario.id === 'device-battery-zigbee-overlap-dark') {
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
