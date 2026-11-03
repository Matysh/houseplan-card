/**
 * Page-level helpers. Everything here goes through the real Home Assistant
 * frontend; the only House Plan knowledge is the declared `data-hp` contract
 * (docs/STYLING-HOOKS.md §7, contract/data-hp-contract.json) and element names.
 */
import { expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { missingHooks } from './contract.mjs';
import { HP, hp } from './hooks.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Log in through HA's own login page and return once the app has loaded. */
export async function loginThroughUi(page, user) {
  await page.goto('/');
  await page.waitForURL(/\/auth\/authorize/, { timeout: 60_000 });
  const username = page.locator('input[name="username"], input[autocomplete="username"]').first();
  const password = page.locator('input[name="password"], input[type="password"]').first();
  await username.waitFor({ state: 'visible', timeout: 60_000 });
  await username.fill(user.username);
  await password.fill(user.password);
  // "Keep me logged in" decides whether HA persists its tokens in
  // localStorage; the saved browser state needs them there. The control is a
  // wa-checkbox: read the real checked state, click the host if needed.
  const keep = page.locator('ha-checkbox').filter({ hasText: /keep me logged in/i }).first();
  const isKept = () => keep.evaluate((el) => !!(el.checked ?? el.shadowRoot?.querySelector('input')?.checked));
  if (await keep.count()) {
    if (!(await isKept())) await keep.click();
    await expect.poll(isKept, { message: 'Keep me logged in did not check' }).toBe(true);
  }
  await password.press('Enter');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/'), { timeout: 60_000 });
  await expect(page.locator('home-assistant-main')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => {
    // fallback for a login page without the checkbox: HA keeps the tokens in
    // memory (window.__tokenCache); persist them the way enableWrite() does
    if (!window.localStorage.getItem('hassTokens') && window.__tokenCache?.tokens) {
      window.localStorage.setItem('hassTokens', JSON.stringify(window.__tokenCache.tokens));
    }
    return !!window.localStorage.getItem('hassTokens');
  }), { timeout: 30_000, message: 'HA did not persist its tokens' }).toBe(true);
}

/** The House Plan card inside whatever host is on the page. */
export function card(page) {
  return page.locator('houseplan-card').first();
}

/**
 * Wait until a plan is actually drawn: rooms are the first thing the card
 * renders after its server snapshot arrived, and a stage with real size is
 * what the user sees. Returns the stage bounding box.
 */
export async function expectPlanDrawn(page, host = card(page)) {
  await expect(host).toBeVisible({ timeout: 60_000 });
  // declared readiness (data-hp-state); rooms and a sized stage are the
  // user-visible proof
  await expect(host.locator(HP.ready)).toBeVisible({ timeout: 60_000 });
  const rooms = host.locator(HP.room);
  await expect.poll(() => rooms.count(), { timeout: 60_000, message: 'no rooms drawn' }).toBeGreaterThan(0);
  const stage = stageOf(host);
  await expect(stage).toBeVisible();
  await expect.poll(async () => (await stage.boundingBox())?.height ?? 0, {
    timeout: 30_000, message: 'stage has no height',
  }).toBeGreaterThan(200);
  return stage.boundingBox();
}

/**
 * The plan surface: the declared `stage` SVG (#1011, since 1.83.0); on an
 * older product under test (nightly latest, upgrade source) the card itself,
 * which is what the size assertions need.
 */
export function stageOf(host) {
  return missingHooks(['stage']).length ? host.locator('ha-card').first() : host.locator(hp('stage')).first();
}

export const deviceMarker = (host, entityId) => host.locator(HP.device(entityId)).first();
export const spaceTabs = (host) => host.locator(HP.spaceTab);
/**
 * The spaces the header offers, in whichever form it settled on
 * (houseplan-card#997, 1.83.0): a tab per space on a header wider than
 * 1024 px, the options of one compact select (`space-select-value`, its values
 * are space ids, its labels their titles) at 1024 px or narrower — and the
 * journeys' 1280 px window with HA's sidebar open is exactly that. The two
 * forms never show together; tabs drawn for a moment before the select's
 * element has loaded count the same spaces.
 */
export const spaceEntries = (host) => host.locator(`${HP.spaceTab}, ${hp('space-select-value')} option`);
export const spaceEntry = (host, spaceId) => host.locator(
  `${hp('space-tab', { space: spaceId })}, ${hp('space-select-value')} option[value="${spaceId}"]`);
/** The three editor mode tabs. */
export const editorTabs = (host) => host.locator(HP.editorTabs);

/** In-app navigation (no page load), the way HA's own sidebar does it. */
export async function navigateInApp(page, path) {
  await page.evaluate((p) => {
    history.pushState(null, '', p);
    window.dispatchEvent(new CustomEvent('location-changed'));
  }, path);
}

/** Where the evidence frames of this run go (artifact + diff input). */
export const EVIDENCE_DIR = resolve(ROOT, process.env.E2E_EVIDENCE_DIR || 'evidence-out');

/**
 * A frame of evidence (houseplan-card#1010): attached to the Playwright report
 * and kept as `<project>/<spec>/<name>.png` for the per-run diff against the
 * last stable release (scripts/evidence-diff.mjs). Never an assertion: the
 * diff is material to look at, the product's golden suite owns pixel fidelity.
 *
 * Frames are taken the same way every time so the diff shows the product, not
 * the camera: the viewport only, CSS animations stopped at their end state
 * (alarm pulses, fades), no caret, the pointer parked in the corner (no hover
 * tooltip), fonts loaded and two frames of layout.
 */
export async function evidence(testInfo, page, name, { keepPointer = false } = {}) {
  const file = name.replace(/\.png$/i, '');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(file)) throw new Error(`evidence name "${name}": lower-case words and dashes`);
  // a tooltip under a resting pointer is not part of the state being shown
  if (!keepPointer && !testInfo.project.use?.isMobile) await page.mouse.move(1, 1);
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  // finite transitions and animations (a toolbar fading in) run to their end;
  // endless ones (alarm pulses) are stopped by the screenshot itself
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'
    || !Number.isFinite(a.effect?.getComputedTiming?.().endTime)), null, { timeout: 3_000 }).catch(() => {});
  const body = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  const spec = basename(testInfo.file).replace(/\.spec\.mjs$/, '').replace(/\.(admin|viewer|mobile)$/, '');
  const target = resolve(EVIDENCE_DIR, testInfo.project.name, spec, `${file}.png`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
  await testInfo.attach(`${file}.png`, { body, contentType: 'image/png' });
}
