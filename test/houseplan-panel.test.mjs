import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#486 panel shell keeps one full card and forwards HA properties without inventing card config', () => {
  const panel = source('src/houseplan-panel.ts');
  assert.match(panel, /import '\.\/houseplan-card';/);
  assert.match(panel, /if \(this\._card \|\| !this\.shadowRoot\) return;/);
  assert.match(panel, /card\.setConfig\(\{ type: 'custom:houseplan-card' \}\);/);
  assert.match(panel, /if \(this\._card\) this\._card\.hass = value;/);
  assert.match(panel, /public set narrow\(value: boolean\)/);
  assert.match(panel, /public set route\(value: unknown\)/);
  assert.match(panel, /public set panel\(value: unknown\)/);
  assert.doesNotMatch(panel, /kiosk\s*:/, 'HA shell state must not enable card kiosk mode');
});

test('#1120 the full-height shell delegates the accessible HA menu to every ordinary card header', () => {
  const panel = source('src/houseplan-panel.ts'), card = source('src/houseplan-card.ts');
  const menu = source('src/panel-header-menu.ts'), styles = source('src/styles/panel-header.styles.ts');
  assert.doesNotMatch(panel, /createElement\('header'\)|panel-title|panel-menu|hass-toggle-menu/);
  assert.match(panel, /grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(panel, /page\.append\(content\)/);
  assert.match(panel, /\.content \{[\s\S]*min-width: 0;[\s\S]*min-height: 0;[\s\S]*overflow: hidden;/);
  assert.match(menu, /data-hp="panel-menu"/);
  assert.match(menu, /aria-label=\$\{state.label\}/);
  assert.match(menu, /new CustomEvent\('hass-toggle-menu', \{\s*bubbles: true, composed: true,\s*\}\)/);
  assert.match(styles, /width:44px; height:44px; min-width:44px; min-height:44px/);
  assert.match(styles, /\.panel-menu:focus-visible/);
  assert.match(card, /private _renderPanelMenu\(\)[^{]*\{\s*if \(!this.panelHost\) return nothing;\s*return renderPanelMenu\(panelMenuState\(this.hass, !!this.narrow, this._kiosk,/);
  assert.match(card, /private _renderEmptyPanelHeader\(\)[^{]*\{\s*if \(!this.panelHost \|\| this._kiosk\) return nothing;[\s\S]*?if \(!menu.visible\) return nothing;/);
  assert.equal((card.match(/\$\{this\.panelHost \? this\._renderEmptyPanelHeader\(\) :/g) || []).length, 3,
    'pending, invalid and read-only empty branches retain the ordinary HA exit');
});

test('#488 the shell sizes itself from the viewport and adopts pre-upgrade HA properties', () => {
  const panel = source('src/houseplan-panel.ts');
  // <ha-panel-custom> is a height-less block with safe-area padding: a percentage
  // host height resolves to auto and the stage collapses to 0 px. The fallback
  // 100vh must come first so the dvh/inset line wins wherever it is supported.
  assert.match(panel, /:host \{[\s\S]*?height: 100vh;\s+height: calc\(100dvh - var\(--safe-area-inset-top, 0px\) - var\(--safe-area-inset-bottom, 0px\)\);/);
  assert.doesNotMatch(panel, /:host \{[^}]*height: 100%;/,
    'the host must not take its height from the height-less ha-panel-custom container');
  // HA assigns these before the top-level-await entry defines the element.
  assert.match(panel, /const PRE_UPGRADE_PROPERTIES = \['panel', 'hass', 'narrow', 'route'\] as const;/);
  assert.match(panel, /public constructor\(\) \{[\s\S]*?this\._adoptPreUpgradeProperties\(\);[\s\S]*?public connectedCallback\(\): void \{\s+this\._adoptPreUpgradeProperties\(\);/);
  assert.match(panel, /if \(!Object\.prototype\.hasOwnProperty\.call\(this, key\)\) continue;[\s\S]*?delete \(this as unknown as Record<string, unknown>\)\[key\];/);
});

test('#648 only the full card advertises resizable Sections defaults', () => {
  const card = source('src/houseplan-card.ts');
  const spaceCard = source('src/space-card.ts');
  assert.match(card, /getGridOptions\(\): \{ columns: 'full'; rows: number; min_rows: number \} \{\s*return \{ columns: 'full', rows: 10, min_rows: 6 \};\s*\}/);
  assert.match(card, /getCardSize\(\): number/);
  assert.doesNotMatch(spaceCard, /getGridOptions/);
});

test('#486 read-only empty state is localized in every shipped frontend dictionary', () => {
  for (const locale of ['en', 'ru', 'de', 'fr']) {
    const dictionary = JSON.parse(source(`src/i18n/${locale}.json`));
    assert.equal(typeof dictionary['empty.read_only'], 'string');
    assert.ok(dictionary['empty.read_only'].trim().length > 0);
  }
  const card = source('src/houseplan-card.ts');
  assert.match(card, /this\._serverStorage && this\._canManageConfiguration/);
  assert.match(card, /this\._serverStorage \? 'empty\.read_only' : 'empty\.install'/);
});
