// #609: explicit authentic Home Assistant form-shell diagnostic. This is not
// a regular smoke: it loads the pinned official HA frontend, opens the real
// Room settings form, and verifies the public ha-dialog geometry on desktop
// and both sides of HA's built-in 450 px mobile breakpoint.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
import { launchHaDialogFixture } from './helpers/ha-dialog-fixture.mjs';

const capture = process.argv.includes('--capture');
const pairDir = fileURLToPath(new URL('../docs/design/600-settings-dialogs/pairs/', import.meta.url));
const fixture = await launchHaDialogFixture({
  authentic: true,
  viewport: { width: 1600, height: 1000 },
});
const { page } = fixture;

const settle = async () => {
  await page.evaluate(async () => {
    const card = window.__card;
    await card.updateComplete;
    const shell = card.shadowRoot.querySelector('hp-dialog[data-kind="room"]');
    if (shell) await shell.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  // Authentic WebAwesome applies a 200 ms show transform; geometry captured
  // during it is intentionally smaller than the settled dialog surface.
  await page.waitForTimeout(250);
};

const inspect = async () => page.evaluate(() => {
  const card = window.__card;
  const shell = card.shadowRoot.querySelector('hp-dialog[data-kind="room"]');
  const ha = shell?.shadowRoot.querySelector('ha-dialog');
  const wa = ha?.shadowRoot.querySelector('wa-dialog');
  const panel = wa?.shadowRoot.querySelector('dialog');
  const haBody = ha?.shadowRoot.querySelector('.body');
  const formBody = shell?.querySelector('.body');
  const formCard = shell?.querySelector('.hpf-card');
  const footer = shell?.querySelector('[slot="footer"]');
  if (!panel || !haBody || !formBody || !formCard || !footer) {
    return { missing: { shell: !!shell, ha: !!ha, wa: !!wa, panel: !!panel,
      haBody: !!haBody, formBody: !!formBody, formCard: !!formCard, footer: !!footer } };
  }
  const rect = (node) => {
    const value = node.getBoundingClientRect();
    return { x: value.x, y: value.y, width: value.width, height: value.height,
      right: value.right, bottom: value.bottom };
  };
  const panelStyle = getComputedStyle(panel);
  const haStyle = getComputedStyle(ha);
  const haBodyStyle = getComputedStyle(haBody);
  const formBodyStyle = getComputedStyle(formBody);
  const cardStyle = getComputedStyle(formCard);
  const panelBox = panel.getBoundingClientRect();
  const overflowNodes = [];
  const visit = (root) => {
    for (const node of root.querySelectorAll('*')) {
      const box = node.getBoundingClientRect();
      // wa-dialog itself stays in document flow at the demo host's 8 px page
      // inset; its rendered native dialog is fixed and is the geometry users see.
      if (node.localName !== 'wa-dialog' && box.width > 0
        && (box.left < panelBox.left - 1 || box.right > panelBox.right + 1)) {
        overflowNodes.push({ tag: node.localName, id: node.id, className: String(node.className || ''),
          left: box.left, right: box.right, width: box.width });
      }
      if (node.shadowRoot) visit(node.shadowRoot);
    }
  };
  visit(shell);
  visit(shell.shadowRoot);
  return {
    viewport: { width: innerWidth, height: innerHeight },
    panel: rect(panel), haBody: rect(haBody), formBody: rect(formBody), footer: rect(footer),
    panelBorderRadius: panelStyle.borderRadius,
    haBodyPadding: haBodyStyle.padding,
    dialogContentPadding: {
      shell: getComputedStyle(shell).getPropertyValue('--dialog-content-padding').trim(),
      ha: haStyle.getPropertyValue('--dialog-content-padding').trim(),
      body: haBodyStyle.getPropertyValue('--dialog-content-padding').trim(),
    },
    haBodyOverflowY: haBodyStyle.overflowY,
    haBodyScroll: [haBody.scrollHeight, haBody.clientHeight],
    formBodyOverflowY: formBodyStyle.overflowY,
    formBodyBackground: formBodyStyle.backgroundColor,
    cardBackground: cardStyle.backgroundColor,
    horizontalOverflow: overflowNodes.length > 0,
    documentWidth: [document.documentElement.scrollWidth, document.body.scrollWidth],
    overflowNodes: overflowNodes.slice(0, 20),
  };
});

const clipPanel = async (name, state) => {
  if (!capture) return;
  const clip = {
    x: Math.max(0, state.panel.x),
    y: Math.max(0, state.panel.y),
    width: Math.min(state.viewport.width, state.panel.width),
    height: Math.min(state.viewport.height, state.panel.height),
  };
  await page.screenshot({ path: join(pairDir, name), clip });
};

try {
  await page.goto(`${fixture.url}/product.html`);
  await page.waitForFunction(() => window.__card?._model?.length > 0
    && window.__card?._booting === false);
  await assertFreshDemoBundle(page);
  await page.evaluate(async () => {
    const card = window.__card;
    if (card._ensureEditorRuntime && !await card._ensureEditorRuntime()) {
      throw new Error('Editor runtime failed to load');
    }
    card._openRoomEdit(card._curSpaceCfg.rooms[0]);
    card.requestUpdate();
    await card.updateComplete;
  });
  await page.waitForFunction(() => {
    const shell = window.__card.shadowRoot.querySelector('hp-dialog[data-kind="room"]');
    const ha = shell?.shadowRoot.querySelector('ha-dialog');
    return ha?.open === true
      && ha.shadowRoot.querySelector('wa-dialog')?.shadowRoot.querySelector('dialog')?.matches(':modal');
  });
  await settle();

  const desktop = await inspect();
  assert.equal(desktop.missing, undefined, JSON.stringify(desktop.missing));
  assert.ok(Math.abs(desktop.panel.width - 560) <= 1, `desktop width ${desktop.panel.width}`);
  assert.ok(desktop.panel.height <= 941 && desktop.panel.height <= desktop.viewport.height - 47,
    `desktop height ${desktop.panel.height}`);
  if (desktop.haBodyPadding !== '0px') console.error(JSON.stringify(desktop, null, 2));
  assert.equal(desktop.haBodyPadding, '0px', JSON.stringify(desktop.dialogContentPadding));
  assert.equal(desktop.haBodyOverflowY, 'auto');
  assert.equal(desktop.formBodyOverflowY, 'visible');
  assert.notEqual(desktop.formBodyBackground, desktop.cardBackground);
  assert.ok(desktop.haBodyScroll[0] > desktop.haBodyScroll[1], `desktop scroll ${desktop.haBodyScroll}`);
  assert.ok(desktop.footer.bottom <= desktop.panel.bottom + 1);
  await clipPanel('room-ha-light.png', desktop);

  await page.setViewportSize({ width: 480, height: 800 });
  await settle();
  const edge = await inspect();
  assert.ok(Math.abs(edge.panel.width - 480) <= 1, `480px width ${edge.panel.width}`);
  assert.ok(Math.abs(edge.panel.height - 800) <= 1, `480px height ${edge.panel.height}`);
  assert.equal(edge.panelBorderRadius, '0px');
  if (edge.horizontalOverflow) console.error(JSON.stringify(edge, null, 2));
  assert.equal(edge.horizontalOverflow, false);
  assert.ok(edge.footer.bottom <= edge.panel.bottom + 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  const mobile = await inspect();
  assert.ok(Math.abs(mobile.panel.width - 390) <= 1, `390px width ${mobile.panel.width}`);
  assert.ok(Math.abs(mobile.panel.height - 844) <= 1, `390px height ${mobile.panel.height}`);
  assert.equal(mobile.panelBorderRadius, '0px');
  assert.equal(mobile.horizontalOverflow, false);
  assert.ok(mobile.footer.bottom <= mobile.panel.bottom + 1);
  await clipPanel('room-ha-mobile-light.png', mobile);

  await page.setViewportSize({ width: 1280, height: 480 });
  await settle();
  const short = await inspect();
  assert.ok(Math.abs(short.panel.height - 480) <= 1, `short HA fullscreen height ${short.panel.height}`);
  assert.equal(short.panelBorderRadius, '0px');

  await fixture.assertClean();
  console.log(JSON.stringify({
    issue: 609,
    authenticHaFrontend: fixture.provenance,
    capture,
    desktop,
    edge480: edge,
    mobile390: mobile,
    shortViewport: short,
    pageErrors: fixture.errors,
    externalRequests: fixture.externalRequests,
    websocketAttempts: fixture.websocketAttempts,
  }, null, 2));
  console.log('OK');
} finally {
  await fixture.close();
}
