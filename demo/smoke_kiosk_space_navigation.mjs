// #1127: public inputs and DOM actions; private card state is read-only evidence.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('smoke_kiosk_space_navigation');
const { page, browser } = await launch({ width: 1000, height: 800 }, 1, [], { hasTouch: true });
const out = {};
const root = page.locator('#host > houseplan-card');
const nav = () => root.locator('[data-hp="kiosk-spaces"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const shown = () => nav().evaluate(n => n.classList.contains('is-visible') && !n.inert && n.getAttribute('aria-hidden') === 'false');
const camera = () => page.evaluate(() => JSON.stringify([window.__card._zoom, window.__card._view]));
const advance = async ms => { await page.clock.fastForward(ms); await page.clock.runFor(220); await page.waitForTimeout(180); await settle(); };
const fieldPoint = async () => {
  const box = await root.locator('.stage').boundingBox();
  const viewport = page.viewportSize();
  const point = { x: Math.min(box.x + box.width - 8, viewport.width - 12), y: Math.min(box.y + box.height - 8, viewport.height - 12) };
  const inside = await root.evaluate((c, p) => c.shadowRoot.querySelector('.stage').contains(c.shadowRoot.elementFromPoint(p.x, p.y)), point);
  if (!inside) throw Error(`Field witness must hit the rendered stage inside the viewport: ${JSON.stringify({ box, point })}`);
  return point;
};
const tapField = async () => { const p = await fieldPoint(); await page.touchscreen.tap(p.x, p.y); await settle(); };
const config = async (kiosk, floor) => {
  await page.evaluate(({ kiosk, floor }) => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk, cycle: 0,
    ...(floor === undefined ? {} : { floor }) }), { kiosk, floor }); await settle();
};
try {
  await page.clock.install();
  out.normalViewAbsent = await nav().count() === 0;
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(c => {
      c.spaces = c.spaces.slice(0, 2);
      c.spaces[0].title = 'Ground'; c.spaces[1].title = 'Upper <test>';
      window.__navIds = c.spaces.map(s => s.id);
      c.settings ||= {};
      c.settings.external_screens = { version: 2, next_id: 3, screens: [1, 2].map(id => ({
        id, space: id === 1 ? c.spaces[0].id : null, cycle: 0, idle: 0,
        default_view: { rotation: 0, zoom: 1, summary: 'local', center_summary: false, icon_scale: null, font_scale: null }, space_views: {},
      })) };
      return c;
    });
  });
  await config(true);
  out.initiallyInert = await nav().evaluate(n => n.inert && getComputedStyle(n).visibility === 'hidden' && getComputedStyle(n).pointerEvents === 'none');
  const field = await root.locator('.stage').boundingBox();
  await page.mouse.move(field.x + 150, field.y + 150); await advance(1000);
  out.hoverDoesNotReveal = !await shown();
  await tapField();
  out.tapReveals = await shown();
  out.layoutAndNames = await nav().evaluate(n => {
    const stage = n.closest('.stage').getBoundingClientRect(), b = n.getBoundingClientRect(), s = getComputedStyle(n);
    const buttons = [...n.querySelectorAll('button')];
    return Math.abs(b.left - stage.left) < .5 && Math.abs(b.y + b.height / 2 - stage.y - stage.height / 2) < .5
      && s.borderTopLeftRadius === '0px' && s.borderBottomLeftRadius === '0px' && s.borderTopRightRadius === '12px'
      && buttons.every(b => b.getBoundingClientRect().width === 44 && b.getBoundingClientRect().height === 44)
      && buttons.map(b => b.textContent.trim()).join(',') === '1,2'
      && buttons[1].getAttribute('aria-label') === 'Upper <test>' && buttons[1].dataset.hpTooltip === 'Upper <test>';
  });
  out.noDots = await root.locator('.kioskdots').count() === 0;
  const before = await camera(), stageBefore = await root.locator('.stage').boundingBox();
  await advance(4000); await tapField(); await advance(2000);
  out.actionRenewsFiveSeconds = await shown();
  await advance(3100);
  out.idleHidesAndRemovesFocusHits = !await shown() && await nav().evaluate(n => n.inert && getComputedStyle(n).visibility === 'hidden'
    && getComputedStyle(n).pointerEvents === 'none' && !n.contains(n.getRootNode().activeElement));
  out.overlayDoesNotChangeCameraOrField = before === await camera() && JSON.stringify(stageBefore) === JSON.stringify(await root.locator('.stage').boundingBox());

  await tapField();
  const p = await fieldPoint(); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, -450); await page.clock.runFor(500); await settle();
  out.planZoomed = await page.evaluate(() => window.__card._zoom > 1.01);
  const second = nav().locator('button').nth(1);
  await second.tap(); await settle();
  out.buttonNavigatesWhileZoomed = await page.evaluate(() => window.__card._space === window.__navIds[1]);
  out.activeFollowsSpace = await second.getAttribute('aria-current') === 'page';
  out.buttonNeverStartsPan = await page.evaluate(() => window.__card._pointers.size === 0 && window.__card._panStart === null);
  await second.focus(); await page.keyboard.press('ArrowDown'); await advance(4000);
  out.keyboardRenewsVisible = await shown();
  // Long pointer ownership survives the idle duration. Two fingers exercise pinch ownership.
  await page.evaluate(() => {
    const stage = window.__card.shadowRoot.querySelector('.stage'), b = stage.getBoundingClientRect();
    for (const id of [91, 92]) stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true,
      pointerId: id, pointerType: 'touch', button: 0, buttons: 1, clientX: b.x + 300 + id, clientY: b.y + 200 }));
  });
  await advance(6000); out.heldPointersKeepVisible = await shown();
  await page.evaluate(() => {
    const stage = window.__card.shadowRoot.querySelector('.stage');
    for (const id of [91, 92]) stage.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, composed: true, pointerId: id, pointerType: 'touch' }));
  });
  await advance(5100); out.outsideTerminalStartsIdle = !await shown();
  const oldSpace = await page.evaluate(() => window.__card._space);
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 1 }));
  await advance(62000);
  out.carouselDoesNotReveal = !await shown() && await page.evaluate(old => window.__card._space !== old, oldSpace);
  await config(true);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await tapField();
  out.reducedMotionNoTransition = await nav().evaluate(n => getComputedStyle(n).transitionDuration.split(',').every(v => parseFloat(v) === 0));
  await advance(5100); out.reducedMotionStillExpires = !await shown();
  await tapField();
  await page.evaluate(() => { const c = window.__card, parent = c.parentNode; c.remove(); parent.append(c); }); await settle();
  out.disconnectResets = !await shown();
  await config(true, 'f1'); await tapField(); out.fixedFloorAbsent = await nav().count() === 0;
  await config(false); await page.evaluate(() => window.__hpTest.setMode('plan')); out.editorAbsent = await nav().count() === 0;
  await page.evaluate(() => window.__hpTest.setMode('view'));

  // Main-panel route input, actual profile resolver and existing fixed-floor guard.
  await page.evaluate(() => {
    document.getElementById('host').style.height = '800px';
    window.__card.panelHost = true;
    window.__card.routeKiosk = { enabled: true, position: null, profile: 1 };
  }); await settle();
  await page.waitForFunction(() => window.__card._externalScreen.profile === 1);
  await tapField();
  out.singleSpaceProfileAbsentWithTwoInstalled = await nav().count() === 0 && await page.evaluate(() => window.__card._model.length === 2 && window.__card._hasFixedFloor);
  await page.evaluate(() => { window.__card.routeKiosk = { enabled: true, position: 1 }; }); await settle();
  await tapField(); out.positionalRouteAbsent = await nav().count() === 0;
  await page.evaluate(() => { window.__card.routeKiosk = { enabled: true, position: null, profile: 2 }; }); await settle();
  await page.waitForFunction(() => window.__card._externalScreen.profile === 2); await tapField();
  out.allSpacesProfileVisible = await shown();
  await page.evaluate(() => window.__hpTest.setServerConfig(c => ({ ...c, spaces: c.spaces.slice(0, 1) })));
  await tapField(); out.oneSpaceAbsent = await nav().count() === 0;
  await page.evaluate(() => window.__hpTest.setServerConfig(c => ({ ...c,
    spaces: Array.from({ length: 20 }, (_, i) => ({ ...c.spaces[0], id: `nav-${i}`, title: `Floor ${i + 1}` })),
  })));
  await tapField();
  out.longListFitsFieldAndScrolls = await nav().evaluate(n => {
    const b = n.getBoundingClientRect(), stage = n.closest('.stage').getBoundingClientRect();
    return b.top >= stage.top && b.bottom <= stage.bottom && n.scrollHeight > n.clientHeight
      && getComputedStyle(n).touchAction === 'pan-y';
  });
  await nav().hover(); await page.mouse.wheel(0, 700); await page.waitForTimeout(160);
  out.wheelScrollsButtonsWithoutPlan = await nav().evaluate(n => n.scrollTop > 0);
  checkAll(out);
} finally { await finish(browser, out); }
