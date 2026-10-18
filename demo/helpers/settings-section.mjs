/** Use the visible settings navigation after every dialog opening. */
export async function settingsSection(dialog,id) {
 const mobile=dialog.locator('.hpf-settings-mobile');
 if(await mobile.isVisible())await mobile.locator('select').selectOption(id);
 else await dialog.locator(`[data-section-target="${id}"]`).click();
}
