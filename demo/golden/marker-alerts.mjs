/** #1000 captures confirmed production projections and actual nested controls. */
export async function prepareMarkerAlerts(page, scenario) {
  const face = page.locator('[data-hp="device"][data-id="appliance"]').first();
  if (scenario.deviceAlerts !== 'form') {
    if (scenario.deviceAlerts === 'alarm') {
      // Golden intentionally honors reduced motion, which hides pulse rings.
      await face.locator('.device-pulse.alarm').waitFor({ state: 'attached', timeout: 6500 });
      const paint = await face.evaluate(node => ({ active: node.classList.contains('alarm'),
        background: getComputedStyle(node).getPropertyValue('--device-face-bg').trim().toLowerCase() }));
      if (!paint.active || paint.background !== '#f0410c') throw new Error(`unconfirmed alarm paint: ${JSON.stringify(paint)}`);
    }
    else await face.locator('.device-attention').waitFor({ timeout: 6500 });
    const actual = await face.evaluate(node => ({ attention: node.querySelectorAll('.device-attention').length,
      maintenance: node.querySelectorAll('.device-maintenance').length, alarm: node.querySelectorAll('.device-pulse.alarm').length }));
    const expected = scenario.deviceAlerts === 'alarm' ? { attention: 0, maintenance: 0, alarm: 1 }
      : { attention: 1, maintenance: scenario.deviceAlerts === 'maintenance' ? 1 : 0, alarm: 0 };
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`threshold level/priority failed: ${JSON.stringify(actual)}`);
    if (actual.attention) await page.waitForFunction(() => !!window.__goldenCard.renderRoot
      .querySelector('.device-attention ha-icon')?.shadowRoot?.querySelector('path')?.getAttribute('d'));
    if (scenario.alertCard) {
      await face.click(); const card = page.locator('hp-dialog[data-kind="info"]');
      await card.locator('.device-issues.attention .device-issue').first().waitFor();
      if (await card.locator('.device-issue').count() !== 4 || await card.locator('.device-issues.attention .device-issue[data-source="sensor.alert_co2"]').count() !== 2 || !await card.locator('.device-issues.maintenance').count()
        || !await card.locator('.device-issues.alarm').count()) throw new Error('threshold/native reason groups lost');
    }
    return actual;
  }
  await face.dblclick(); const marker = page.locator('hp-dialog[data-kind="marker"]'); await marker.waitFor({ state: 'attached' });
  if (await marker.locator('.hpf-settings-mobile').isVisible()) await marker.locator('.hpf-settings-mobile select').selectOption('alarms');
  else await marker.locator('[data-section-target="alarms"]').click();
  await marker.locator('.alarm-empty').waitFor();
  if (scenario.alertForm === 'empty') return { empty: true };
  await marker.locator('[data-hp="alarm-create"]').click(); const dialog = page.locator('hp-dialog[data-kind="alarm-constructor"]');
  const pick = async (id, value) => {
    const select = dialog.locator(`#${id}`), control = select.locator('..');
    const label = await select.locator('option').evaluateAll((options, value) => options.find(option => option.value === value)?.label, value);
    if (!label) throw new Error(`threshold form missing ${id}/${value}`);
    await control.locator('button').click(); await control.getByRole('option', { name: label, exact: true }).click();
  };
  await pick('alarm-source', JSON.stringify([scenario.alertForm === 'enum' ? 'binary_sensor.alert_window' : 'sensor.alert_co2', null]));
  if (scenario.alertForm === 'enum') { await pick('alarm-value', 'on');
    if (await dialog.locator('input#alarm-value').count()) throw new Error('binary form exposed free text'); }
  else { await pick('alarm-operator', 'gt'); await dialog.locator('#alarm-value').fill('1000'); }
  if (await dialog.locator('[data-hp="alarm-ok"]').isDisabled()) throw new Error('valid threshold form cannot commit');
  return { form: scenario.alertForm };
}
