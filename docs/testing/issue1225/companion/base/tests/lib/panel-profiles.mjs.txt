// #1113 real HA profile fixtures and public UI adapters. No production props,
// invented WS responses, .storage writes or backwards identity-counter reset.
import { hasBeta5UiPolishContract } from './panel-release-contract.mjs';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { USERS, HA_URL } from '../../scripts/users.mjs';
import { hp, HP } from './hooks.mjs';
import { card, expectPlanDrawn } from './ha-page.mjs';
import { settle, stage } from './plan.mjs';
import { planConfig, wsCall } from './ha-ws.mjs';

export const PROFILE_HOOKS = ['external-screen-add', 'external-screen-edit', 'external-screen-delete',
  'external-screen-ok', 'settings-section', 'field', 'dialog', 'select-trigger', 'select-menu',
  'select-option', 'stage', 'device', 'room', 'summary-panel', 'summary-toggle', 'summary-settings', 'hidden-devices'];
export const HIDDEN_MARKER = 'v_demo_laptop';
export const ICON_LABEL = 'Device icon size', TEXT_LABEL = 'Room card text size';
export const screenDefaults = id => ({ id, space: null, rotation: 0, cycle: 0, idle: 0,
  summary: 'local', hidden_devices: 'local', icon_scale: null, font_scale: null, controls: true });
export const profileNamespace = config => config.settings?.external_screens;
export const profileOf = (config, id) => profileNamespace(config)?.screens.find(row => row.id === id);

export class ProfileFixture {
  constructor() { this.contexts = []; this.seed = null; this.viewer = null; this.mutated = false; this.createdIds = new Set(); }
  async setup() {
    const saved = await planConfig();
    expect(saved.external_screens_api, 'actual HA backend supports stored profiles').toBe(1);
    expect(saved.external_screens_events_api, 'actual HA backend supports authenticated profile events').toBe(1);
    this.seed = structuredClone(saved.config);
    const previous = profileNamespace(this.seed) || { version: 1, next_id: 1, screens: [] };
    expect(previous.version, 'profile fixture requires the supported namespace').toBe(1);
    expect(previous.screens.length).toBeLessThanOrEqual(18);
    const config = structuredClone(this.seed), id = previous.next_id;
    expect(Number.isSafeInteger(id) && id < Number.MAX_SAFE_INTEGER - 2, 'fixture has two fresh IDs available').toBe(true);
    this.id = id; this.localId = id + 1;
    this.createdIds.add(id); this.createdIds.add(id + 1);
    this.profile = { ...screenDefaults(id), space: 'f2', rotation: 90, summary: 'show',
      hidden_devices: 'show', icon_scale: 1.75, font_scale: 1.5, controls: false };
    config.settings.external_screens = { ...previous, next_id: id + 2,
      screens: [...previous.screens, this.profile, { ...screenDefaults(id + 1), space: 'f2' }] };
    const hidden = config.markers.find(marker => marker.id === HIDDEN_MARKER);
    expect(hidden?.space).toBe('f2');
    hidden.hidden = true;
    config.settings.filter_seeded = true;
    this.mutated = true;
    await wsCall({ type: 'houseplan/config/set', expected_rev: saved.rev, config });
    const current = await planConfig();
    expect(profileOf(current.config, id)).toEqual(this.profile);
    this.rooms = Object.fromEntries(current.config.spaces.map(space => [space.id, space.rooms.map(room => room.id).sort()]));

  }
  ownProfile(id) { this.createdIds.add(id); }
  async readOnlyViewer() {
    const users = await wsCall({ type: 'config/auth/list' });
    const user = users.find(row => row.username === USERS.viewer.username);
    expect(user && !user.is_owner && !user.system_generated).toBeTruthy();
    this.viewer = { id: user.id, groups: [...user.group_ids] };
    await wsCall({ type: 'config/auth/update', user_id: user.id, group_ids: ['system-read-only'] });
    const observed = (await wsCall({ type: 'config/auth/list' })).find(row => row.id === user.id);
    expect(observed.group_ids).toEqual(['system-read-only']);
    expect((await planConfigForViewer()).can_write).toBe(false);
    return user.id;
  }
  async context(browser, role, { authOnly = false } = {}) {
    let storageState = USERS[role].storageState;
    if (authOnly) {
      // A cold screen inherits only the public HA login state, never any
      // product snapshot/preferences that setup's default dashboard may store.
      const saved = JSON.parse(readFileSync(storageState, 'utf8'));
      storageState = { cookies: saved.cookies, origins: saved.origins.map(origin => ({ ...origin,
        localStorage: origin.localStorage.filter(entry => entry.name === 'hassTokens'),
      })) };
    }
    const context = await browser.newContext({ baseURL: HA_URL, storageState,
      viewport: { width: 1280, height: 800 }, locale: 'en-US', timezoneId: 'Europe/Moscow' });
    this.contexts.push(context);
    return context;
  }
  async cleanup(page) {
    // Close actors before supported CAS cleanup; restore roles even if plan
    // cleanup fails. Retain the greatest allocated ID across the whole suite.
    try {
      try {
        const closed = await Promise.allSettled(this.contexts.map(context => context.close()));
        const failed = closed.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
      }
      finally { if (page && !page.isClosed()) await page.close(); }
    } finally {
      try {
        if (this.seed && this.mutated) for (let attempt = 0; ; attempt++) {
          const current = await planConfig(), original = profileNamespace(this.seed);
          const now = profileNamespace(current.config);
          const next_id = Math.max(original?.next_id || 1, now?.next_id || 1);
          const config = structuredClone(this.seed);
          const originalIds = new Set((original?.screens || []).map(row => row.id));
          const unowned = (now?.screens || []).filter(row => !this.createdIds.has(row.id) && !originalIds.has(row.id));
          const screens = [...(original?.screens || []), ...unowned];
          config.settings.external_screens = { ...(original || { version: 1 }), next_id, screens };
          try {
            await wsCall({ type: 'houseplan/config/set', expected_rev: current.rev, config });
            const restored = (await planConfig()).config;
            expect(withoutProfiles(restored)).toEqual(withoutProfiles(this.seed));
            expect(profileNamespace(restored).screens).toEqual(screens);
            expect(profileNamespace(restored).screens.some(row => this.createdIds.has(row.id))).toBe(false);
            expect(profileNamespace(restored).next_id).toBeGreaterThanOrEqual(next_id);
            break;
          } catch (error) {
            if (error.code !== 'conflict' || attempt === 3) throw error;
          }
        }
      } finally {
        if (this.viewer) {
          await wsCall({ type: 'config/auth/update', user_id: this.viewer.id, group_ids: this.viewer.groups });
          const restored = (await wsCall({ type: 'config/auth/list' })).find(user => user.id === this.viewer.id);
          expect(restored.group_ids).toEqual(this.viewer.groups);
        }
      }
    }
  }
}
export const planConfigForViewer = () => wsCall({ type: 'houseplan/config/get' }, 'viewer');

/** Transparent observer: count REAL application WS commands/ACKs/frames, not
 * Playwright roundtrips or oracle requests. Only the public HA version is
 * retained from auth_required; auth payloads and config bodies are omitted.
 */
export async function profileWire(page) {
  const receipt = { commands: [], replies: [], events: [], haVersions: [], navigations: 0, connections: 0 };
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) receipt.navigations++; });
  await page.routeWebSocket('**/api/websocket', socket => {
    const connection = ++receipt.connections;
    const server = socket.connectToServer(), requests = new Map(), subscriptions = new Set();
    socket.onMessage(raw => {
      let message; try { message = JSON.parse(String(raw)); } catch { server.send(raw); return; }
      if (message.type?.startsWith('houseplan/')) {
        requests.set(message.id, message.type);
        receipt.commands.push({ connection, type: message.type });
      }
      server.send(raw);
    });
    server.onMessage(raw => {
      let decoded; try { decoded = JSON.parse(String(raw)); } catch { socket.send(raw); return; }
      for (const message of Array.isArray(decoded) ? decoded : [decoded]) {
        if (message.type === 'auth_required' && typeof message.ha_version === 'string'
          && /^[0-9][0-9A-Za-z.+_-]{0,63}$/.test(message.ha_version)) {
          receipt.haVersions.push({ connection, version: message.ha_version });
        }
        const type = requests.get(message.id);
        if (message.type === 'result' && type) {
          requests.delete(message.id);
          receipt.replies.push({ connection, type, success: message.success,
            ...(type === 'houseplan/config/get' ? { canWrite: message.result?.can_write === true } : {}),
            ...(Number.isSafeInteger(message.result?.rev) ? { rev: message.result.rev } : {}) });
          if (type === 'houseplan/external_screens/subscribe' && message.success) subscriptions.add(message.id);
        }
        if (message.type === 'event' && subscriptions.has(message.id)) {
          const event = message.event || {};
          receipt.events.push({ connection, kind: ['ready', 'resync', 'closed'].includes(event.kind) ? event.kind : 'update',
            ...(Number.isSafeInteger(event.rev) ? { rev: event.rev } : {}),
            ...(Number.isSafeInteger(event.external_screens_update?.base_rev)
              ? { baseRev: event.external_screens_update.base_rev, profilePatch: true } : {}) });
        }
      }
      socket.send(raw);
    });
  });
  return {
    receipt,
    configGets: () => receipt.commands.filter(command => command.type === 'houseplan/config/get').length,
    saveAcks: () => receipt.replies.filter(reply => reply.type === 'houseplan/config/set' && reply.success),
    async ready() {
      await expect.poll(() => receipt.events.some(event => event.kind === 'ready'),
        { message: 'actual authenticated profile subscription reaches ready' }).toBe(true);
      await this.settle();
    },
    async settle() {
      let last = -1;
      for (let i = 0; i < 20; i++) {
        const count = receipt.commands.length + receipt.replies.length + receipt.events.length;
        await page.waitForTimeout(400);
        if (last === count && count === receipt.commands.length + receipt.replies.length + receipt.events.length) return;
        last = count;
      }
      throw new Error('profile application websocket did not settle');
    },
  };
}

export async function openProfile(page, id, query = '') {
  await page.goto(`/houseplan?hpprofile=${id}${query ? '&' + query : ''}`);
  const host = card(page);
  await expectPlanDrawn(page, host);
  return host;
}
export async function expectFloor(host, fixture, id) {
  await expect.poll(async () => [...new Set(await host.locator(hp('room')).evaluateAll(rooms =>
    rooms.map(room => room.getAttribute('data-id'))))].sort()).toEqual(fixture.rooms[id]);
}
export async function profileSettings(page) {
  await page.goto('/houseplan');
  const host = card(page); await expectPlanDrawn(page, host);
  await host.locator(HP.settings).first().click();
  const dialog = host.locator(HP.dialog('settings')).first(); await expect(dialog).toBeVisible();
  await dialog.locator(hp('settings-section', { kind: 'general', section: 'external-screens' })).first().click();
  return { host, dialog };
}
export const profileEditButton = (dialog, id) => dialog.locator(hp('external-screen-edit'))
  .and(dialog.getByRole('button', { name: `Edit Screen ${id}`, exact: true }));
export async function editProfile(dialog, id) {
  await profileEditButton(dialog, id).click();
  // The constructor is a sibling of General settings, not its descendant.
  const child = card(dialog.page()).locator(HP.dialog('external-screen-constructor')).first();
  await expect(child).toBeVisible(); return child;
}
export async function chooseProfileField(dialog, key, value) {
  const native = dialog.locator(hp('field', { field: `external-screen-${key}` })).first();
  if(key==='controls' && hasBeta5UiPolishContract()) {
    await expect(native).toHaveCount(0); // Retired field is an explicit oracle, not a silent skip.
    return;
  }
  const trigger = native.locator('..').locator(hp('select-trigger')).first();
  await trigger.click();
  const menu = dialog.page().locator(`${hp('select-menu')}[id="${await trigger.getAttribute('aria-controls')}"]`);
  await menu.locator(hp('select-option', { id: value === null ? '' : String(value) })).first().click();
  await expect(native).toHaveValue(value === null ? '' : String(value));
}
export async function finishProfile(child) {
  await child.locator(hp('external-screen-ok')).click(); await expect(child).toBeHidden();
}
export async function saveProfileSettings(dialog, wire) {
  const before = wire?.saveAcks().length ?? 0;
  await dialog.locator(HP.dialogConfirm).first().click();
  if (wire) await expect.poll(() => wire.saveAcks().length).toBe(before + 1);
  await expect(dialog).toBeHidden();
  return wire?.saveAcks().at(-1);
}
export async function sizeDialog(page, host) {
  const surface = stage(host); await surface.scrollIntoViewIfNeeded();
  const box = await surface.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8);
  await page.mouse.down();
  try { await page.waitForTimeout(3100); } finally { await page.mouse.up(); }
  const dialog = host.locator(HP.dialog('kiosk')).first();
  await expect(dialog).toBeVisible(); return dialog;
}
export async function expectSizes(page, host, icon, text, locked = true) {
  const dialog = await sizeDialog(page, host);
  const icons = dialog.getByRole('slider', { name: ICON_LABEL, exact: true });
  const fonts = dialog.getByRole('slider', { name: TEXT_LABEL, exact: true });
  await expect(icons).toHaveValue(String(icon)); await expect(fonts).toHaveValue(String(text));
  if (locked) { await expect(icons).toBeDisabled(); await expect(fonts).toBeDisabled(); }
  else { await expect(icons).toBeEnabled(); await expect(fonts).toBeEnabled(); }
  if (locked) {
    await expect(dialog.getByText('Set by a screen profile or link', { exact: true })).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Reset to defaults', exact: true })).toBeDisabled();
  }
  await dialog.locator(HP.dialogCancel).first().click(); await expect(dialog).toBeHidden();
}
export async function setLocalSizes(page, host, icon, text) {
  const dialog = await sizeDialog(page, host);
  for (const [name, value] of [[ICON_LABEL, icon], [TEXT_LABEL, text]]) {
    const slider = dialog.getByRole('slider', { name, exact: true });
    await expect(slider).toBeEnabled();
    await slider.focus(); await slider.press('Home');
    for (let n = 50; n < value; n += 5) await slider.press('ArrowRight');
    await expect(slider).toHaveValue(String(value));
  }
  await dialog.locator(HP.dialogCancel).first().click(); await expect(dialog).toBeHidden();
}
/** Direction of the visible floor plane, measured through a declared ROOM
 * shape's native SVG matrix. No private rotation or copied geometry formula. */
export async function planDirection(host, roomId) {
  await settle(host);
  const room = host.locator(hp('room', { id: roomId })).first();
  await expect(room).toBeVisible();
  const vector = await room.evaluate(shape => {
    const matrix = shape.getScreenCTM();
    if (!matrix) throw new Error('visible room has no screen matrix');
    const origin = new DOMPoint(0, 0).matrixTransform(matrix);
    const axis = new DOMPoint(1, 0).matrixTransform(matrix);
    return { x: axis.x - origin.x, y: axis.y - origin.y };
  });
  expect(Math.hypot(vector.x, vector.y), 'visible room has a nonzero floor axis').toBeGreaterThan(0);
  return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
}
export function expectQuarterTurn(before, after, degrees = 90) {
  const delta = ((after - before) % 360 + 360) % 360;
  expect(Math.min(Math.abs(delta - degrees), Math.abs(delta - degrees + 360), Math.abs(delta - degrees - 360))).toBeLessThan(3);
}
export function withoutProfiles(config) {
  const result = structuredClone(config); delete result.settings.external_screens; return result;
}
/** Diagnostic JSON paths only. Config values never enter this receipt. */
export function changedPaths(before, after, path = '') {
  if (Object.is(before, after)) return [];
  if (before === null || after === null || typeof before !== 'object' || typeof after !== 'object'
    || Array.isArray(before) !== Array.isArray(after)) return [path || '/'];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap(key => {
    const next = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
    return !(key in before) || !(key in after) ? [next] : changedPaths(before[key], after[key], next);
  });
}

export async function attachProfileReceipt(testInfo, name, wire) {
  await testInfo.attach(name, { body: JSON.stringify(wire.receipt, null, 2), contentType: 'application/json' });
}
