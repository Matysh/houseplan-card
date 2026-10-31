/** Synthetic theme paint, in addition to HA's semantic darkMode flag. */
export async function applyUiKitTheme(page, theme) {
  await page.locator('houseplan-card').evaluate((card, theme) => {
    const dark = theme === 'dark';
    const variables = {
      '--primary-color':dark ? '#3ea6ff' : '#0b73b8',
      '--primary-text-color':dark ? '#e6e7eb' : '#202124',
      '--secondary-text-color':dark ? '#9aa4ad' : '#5f6368',
      '--card-background-color':dark ? '#202126' : '#ffffff',
      '--ha-card-background':dark ? '#202126' : '#ffffff',
      '--divider-color':dark ? '#3a3d45' : '#d7d9de',
      '--secondary-background-color':dark ? '#2b2d33' : '#e7eaee',
    };
    for (const [key, value] of Object.entries(variables)) card.style.setProperty(key, value);
    card.style.colorScheme = theme;
    card.hass = { ...card.hass, themes:{ ...card.hass.themes, darkMode:dark } };
  }, theme);
}
