/**
 * Driving the editors the way an administrator does: real clicks on the plan
 * at floor coordinates, located through the declared `stage` SVG (#1011,
 * docs/STYLING-HOOKS.md §7.8). The SVG viewBox is the floor's own coordinate
 * system (stored geometry × 1000), `data-grid-step` its snap pitch with the
 * grid origin at (0, 0), and `getScreenCTM()` maps it to the pixels the mouse
 * needs. Everything is computed after the camera settles, never cached across
 * a zoom or an editor switch.
 */
import { expect } from '@playwright/test';
import { card, expectPlanDrawn } from './ha-page.mjs';
import { HP, hp } from './hooks.mjs';
import { hasBeta4PanelContract } from './panel-release-contract.mjs';

/** Open the sidebar page and wait for the drawn plan; returns the card host. */
export async function openPlan(page, { space } = {}) {
  await page.goto('/houseplan');
  const host = card(page);
  await expectPlanDrawn(page, host);
  if (space) await selectSpace(host, space);
  return host;
}

export const spaceTab = (host, spaceId) => host.locator(hp('space-tab', { space: spaceId })).first();

/**
 * The space the header shows as current: the compact select's value
 * (houseplan-card#997) or the tab marked `aria-current="page"`; null while
 * neither is drawn.
 */
export async function currentSpace(host) {
  const value = host.locator(hp('space-select-value')).first();
  if (await value.count()) return value.inputValue();
  const tab = host.locator(`${hp('space-tab')}[aria-current="page"]`).first();
  return (await tab.count()) ? tab.getAttribute('data-space') : null;
}

/**
 * Switch spaces the way an administrator does, through whichever navigation
 * the header shows (see `spaceEntries`): the space's tab, or the compact
 * select's own trigger and then its option in the menu the trigger controls.
 * The select's element loads on demand, so the tabs can give way to it in the
 * middle of a step; a step the swap overtook is simply tried again.
 */
export async function selectSpace(host, spaceId) {
  const select = host.locator(hp('space-select')).first();
  await expect(async () => {
    if ((await currentSpace(host)) === spaceId) return;
    if (await select.isVisible()) {
      const trigger = select.locator(hp('select-trigger')).first();
      // a retry finds the menu still open: a second click would close it
      if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click({ timeout: 5_000 });
      const menu = host.page().locator(`${hp('select-menu')}[id="${await trigger.getAttribute('aria-controls')}"]`);
      await menu.locator(hp('select-option', { id: spaceId })).first().click({ timeout: 5_000 });
    } else {
      await spaceTab(host, spaceId).click({ timeout: 5_000 });
    }
    await expect.poll(() => currentSpace(host), { timeout: 5_000 }).toBe(spaceId);
  }).toPass({ timeout: 30_000 });
  await settle(host);
}

export async function enterEditor(host, mode) {
  await host.locator(HP.modeTab(mode)).first().click();
  await expect(host.locator(HP.mode(mode))).toBeVisible();
  await settle(host);
}

export async function leaveEditor(host) {
  await host.locator(HP.editorClose).first().click();
  await expect(host.locator(HP.mode('view'))).toBeVisible();
  await settle(host);
}

export const stage = (host) => host.locator(hp('stage')).first();

/** Zoom through exposed native controls, or the compact panel's native wheel. */
export async function zoomInVisible(host, clicks = 3) {
  const zoom = host.locator(`${hp('zoom-in')}:visible`).first();
  if (await zoom.count()) {
    await expect(zoom).toBeVisible();
    await expect(zoom).toBeEnabled();
    await expect.poll(async () => {
      const owner = await host.boundingBox(), button = await zoom.boundingBox();
      return !!owner && !!button && button.x >= owner.x && button.y >= owner.y
        && button.x + button.width <= owner.x + owner.width + 1
        && button.y + button.height <= owner.y + owner.height + 1;
    }, { message: 'native zoom target stays inside the desktop fixture' }).toBe(true);
    for (let i = 0; i < clicks; i++) await zoom.click();
    return;
  }
  // #1132: wider grouped controls can compact zoom even at a wide viewport.
  // Keep the real editor and native gesture; never reveal hidden controls or
  // mutate the camera. Header-specific journeys retain their own assertions.
  expect(hasBeta4PanelContract(), 'compact native zoom belongs to the panel contract').toBe(true);
  await expect(host.locator(HP.editorClose).first()).toBeVisible();
  const svg = stage(host), page = host.page();
  const scale = () => svg.evaluate(node => {
    const matrix = node.getScreenCTM();
    return matrix ? Math.hypot(matrix.a, matrix.b) : 0;
  });
  const before = await scale(), box = await svg.boundingBox();
  expect(before, 'drawn plan has a positive SVG scale').toBeGreaterThan(0);
  expect(!!box && box.width > 0 && box.height > 0, 'native wheel has a visible plan target').toBe(true);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < clicks; i++) {
    await page.mouse.wheel(0, -120);
    await settle(host);
  }
  await expect.poll(scale, { message: 'native wheel actually zoomed the compact editor' }).toBeGreaterThan(before);
}
/** Let the camera transition and the next two frames finish. */
export async function settle(host) {
  await stage(host).evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 350)));
}

export async function gridStep(host) {
  const step = Number(await stage(host).getAttribute('data-grid-step'));
  if (!(step > 0)) throw new Error(`stage data-grid-step is not a positive number: ${step}`);
  return step;
}

/** Floor coordinates (viewBox units) → client pixels. */
export async function toClient(host, x, y) {
  return stage(host).evaluate((svg, [px, py]) => {
    const m = svg.getScreenCTM();
    const p = new DOMPoint(px, py).matrixTransform(m);
    return { x: p.x, y: p.y };
  }, [x, y]);
}

/** Client pixels → floor coordinates. */
export async function toFloor(host, x, y) {
  return stage(host).evaluate((svg, [px, py]) => {
    const p = new DOMPoint(px, py).matrixTransform(svg.getScreenCTM().inverse());
    return { x: p.x, y: p.y };
  }, [x, y]);
}

/** Snap a floor coordinate to the grid the editor snaps to. */
export async function snap(host, x, y) {
  const step = await gridStep(host);
  return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
}

export async function clickFloor(page, host, x, y, options) {
  const p = await toClient(host, x, y);
  await page.mouse.click(p.x, p.y, options);
}

export async function dblclickFloor(page, host, x, y) {
  const p = await toClient(host, x, y);
  await page.mouse.dblclick(p.x, p.y);
}

/** Press, move in small steps (the editors read pointermove), release. */
export async function dragClient(page, from, to, steps = 12) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  await page.mouse.up();
}

export async function dragFloor(page, host, from, to, steps) {
  await dragClient(page, await toClient(host, from.x, from.y), await toClient(host, to.x, to.y), steps);
}

/** Centre of an element in client pixels (SVG or HTML). */
export async function centreOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Pick a tool of the active editor's toolbar. */
export async function useTool(host, id) {
  const tool = host.locator(HP.tool(id)).first();
  await tool.click();
  return tool;
}

/** A form control by its declared field id, scoped to an owner (dialog, panel). */
export const field = (owner, id, value) => owner.locator(HP.field(id, value)).first();
export const action = (owner, id, value) => owner.locator(HP.action(id, value)).first();

/** Last toast's i18n key (toast[data-id]). */
export async function toastId(host) {
  const toast = host.locator(hp('toast')).last();
  await expect(toast).toBeVisible();
  return toast.getAttribute('data-id');
}
