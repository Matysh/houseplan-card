import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const card = read('src/houseplan-card.ts');
const adapter = read('src/version-recovery-card.ts');
const editor = read('src/houseplan-editor-runtime.ts');
const onboarding = read('src/houseplan-onboarding-runtime.ts');
const controller = read('src/version-recovery.ts');
const styles = read('src/styles/base.styles.ts');

const occurrences = (source, fragment) => source.split(fragment).length - 1;
const matches = (source, pattern) => source.match(pattern)?.length || 0;

test('one host seam owns every full-card config/get request', () => {
  const direct = /callWS(?:<[^>]+>)?\(\{ type: 'houseplan\/config\/get'/g;
  assert.equal(matches(adapter, direct), 1, 'the adapter is the only WS request owner');
  assert.equal(matches(card, direct), 0, 'card flows must use the authoritative seam');
  assert.equal(matches(editor, direct), 0, 'lazy editor flows must use the host seam');
  assert.equal(matches(onboarding, direct), 0, 'onboarding flows must use the host seam');

  assert.match(card,
    /private _getAuthoritativeConfig\(\): Promise<AuthoritativeConfigResponse>/);
  assert.equal(occurrences(card, 'this._getAuthoritativeConfig()'), 2,
    'initial load and config-only reload both use the seam');
  assert.equal(occurrences(editor, 'this.host._getAuthoritativeConfig()'), 3,
    'delete, optimization undo and backup import use the seam');
  assert.equal(occurrences(onboarding, 'this.host._getAuthoritativeConfig()'), 1,
    'empty-install space deletion uses the seam');
});

test('config fulfillment adopts capabilities before aggregate consumers continue', () => {
  const responseAt = controller.indexOf('const response = await request();');
  const adoptAt = controller.indexOf('adopt(response);', responseAt);
  const returnAt = controller.indexOf('return response;', adoptAt);
  assert.ok(responseAt >= 0 && responseAt < adoptAt && adoptAt < returnAt);
  assert.match(adapter,
    /return fetchAuthoritativeConfig\([\s\S]*adoptCardConfigCapabilities\(host, response\)/);
  assert.match(adapter,
    /host\._haIntegrationVersion = normalizeRuntimeVersion\(capabilities\.integration_version\)/);
  assert.match(adapter, /host\._haSupportApi = [\s\S]*\? supportApi : null;/);
  assert.match(adapter, /host\._haDecorAssetsApi = [\s\S]*: null;/);
});

test('banner insets are symmetric and cannot escape the full-card host', () => {
  assert.match(styles,
    /:host\(houseplan-card\) \{\s*display: block;\s*position: relative;\s*\}/);
  const sharedHost = styles.slice(styles.indexOf('    :host {'),
    styles.indexOf('    :host(houseplan-card)'));
  assert.doesNotMatch(sharedHost, /\b(?:display|position):/,
    'space-card shares variables, not the full-card positioning contract');
  const rule = styles.slice(
    styles.indexOf('    .version-recovery {'),
    styles.indexOf('    .version-recovery.phase-visible'),
  );
  assert.match(rule, /left: max\(var\(--sp-5\), env\(safe-area-inset-left\)\);/);
  assert.match(rule, /right: max\(var\(--sp-5\), env\(safe-area-inset-right\)\);/);
  assert.match(rule, /width: auto;/);
  assert.match(rule, /max-width: 430px;/);
  assert.match(rule, /margin-left: auto;/);
  assert.doesNotMatch(rule, /calc\(100%/);
});
