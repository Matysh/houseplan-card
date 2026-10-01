// #661 AC10: the moon switch in General settings — «Sun and Moon» section,
// reset to on, save writes `true` or removes the key; its strings exist in all
// four dictionaries. #718: the status line under it (AC14, K7); #731: a warm
// revive of the dialog is an opening of its own. The dialog is a lazy Lit
// module (its layout is read as a source contract); reading and writing the
// key and the status of an opening are executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  generalDirty, generalDraftKey, moonDraftOf, rememberGeneralBaseline, writeMoonSetting,
} from '../test-build/editors/general-form-state.js';
import { restoreWarmDialogBaseline, warmDialogBaseline } from '../test-build/editors/dialog-baseline.js';
import { moonStatusOf, openMoonStatus } from '../test-build/editors/moon-status.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = (path) => JSON.parse(read(path));

test('#661 AC10: the switch sits in the «Sun and Moon» card under «Sunlight through windows»', () => {
  const dialog = read('src/editors/general-settings-dialog.ts');
  const sun = dialog.slice(dialog.indexOf("id: 'sun',"), dialog.indexOf("id: 'data',"));
  assert.match(sun, /title: t\('gs\.sun_group'\)/);
  const rays = sun.indexOf("id: 'gs-sun-rays'");
  const moon = sun.indexOf("id: 'gs-moon'");
  assert.ok(rays > 0 && moon > rays, 'moon row follows the sun-rays row');
  const row = sun.slice(moon, sun.indexOf('})}', moon));
  assert.match(row, /icon: 'mdi:moon-waning-crescent'/);
  assert.match(row, /title: st\('gs\.moon'\),/);
  // #718 K7: the hint alone until the chunk judged this opening, then the status as its second line.
  assert.match(row, /caption: moonStatus\s+\? html`\$\{st\('gs\.moon_hint'\)\}<span style="display:block" data-moon-status=\$\{moonStatus\.reason\}>\$\{moonStatusText\(moonStatus, st\)\}<\/span>`\s+: st\('gs\.moon_hint'\)/);
  assert.doesNotMatch(row, /aria-live/);
  assert.match(row, /checked: d\.moon, onChange: \(v\) => set\(\{ moon: v \}\)/);
  const reset = dialog.slice(dialog.indexOf("${t('gs.reset')}") - 600, dialog.indexOf("${t('gs.reset')}"));
  assert.match(reset, /moon: true/, 'reset to defaults switches the moon on (new installations)');
});

test('#661 AC10: opening reads only an explicit true; saving writes true or removes the key', () => {
  assert.equal(moonDraftOf({ moon: true }), true);
  for (const settings of [undefined, null, {}, { moon: false }, { moon: 'true' }, { moon: 1 }]) {
    assert.equal(moonDraftOf(settings), false, JSON.stringify(settings));
  }
  const on = { bg_mode: 'daynight' };
  writeMoonSetting(on, true);
  assert.deepEqual(on, { bg_mode: 'daynight', moon: true });
  const off = { bg_mode: 'daynight', moon: true };
  writeMoonSetting(off, false);
  assert.deepEqual(off, { bg_mode: 'daynight' });
  assert.equal('moon' in off, false, 'false is stored as absence');
});

test('#661 AC10: strings in all four dictionaries, section renamed', () => {
  const group = { en: 'Sun and Moon', ru: 'Солнце и Луна', de: 'Sonne und Mond', fr: 'Soleil et Lune' };
  for (const lang of ['en', 'ru', 'de', 'fr']) {
    assert.equal(json(`src/i18n/${lang}.json`)['gs.sun_group'], group[lang], lang);
    const settings = json(`src/i18n/settings/${lang}.json`);
    for (const key of ['gs.moon', 'gs.moon_hint']) {
      assert.ok(typeof settings[key] === 'string' && settings[key].trim(), `${lang} ${key}`);
    }
  }
  assert.equal(json('src/i18n/settings/ru.json')['gs.moon'], 'Луна на плане в сумерках и ночью');
  assert.equal(json('src/i18n/settings/en.json')['gs.moon'], 'Moon over the plan at dusk and night');
});

/** #718: the seven keys, RU and EN verbatim from the specification. */
const MOON_KEYS = {
  'gs.moon_hint': {
    ru: 'Видна за планом при любом фоне, от 3° над горизонтом, кроме новолуния; положение считается по координатам дома из Home Assistant.',
    en: 'Shown behind the plan with any background, from 3° above the horizon, except around new moon; computed from the home coordinates in Home Assistant.',
  },
  'gs.moon_status_shown': {
    ru: 'Сейчас: показывается (на {alt}° над горизонтом, освещено {pct}\u00a0%).',
    en: 'Now: shown ({alt}° above the horizon, {pct}% lit).',
  },
  'gs.moon_status_no_home': {
    ru: 'Сейчас: не показывается (в Home Assistant не заданы координаты дома).',
    en: 'Now: not shown (the home location is not set in Home Assistant).',
  },
  'gs.moon_status_day_sun': {
    ru: 'Сейчас: не показывается (Солнце на {sun}° над горизонтом, луна видна, когда оно ниже 6°).',
    en: 'Now: not shown (the sun is {sun}° above the horizon; the moon shows once it is below 6°).',
  },
  'gs.moon_status_day_clock': {
    ru: 'Сейчас: не показывается (день по часам, 08:00\u201318:00: в Home Assistant нет данных sun.sun).',
    en: 'Now: not shown (daytime by the clock, 08:00\u201318:00: Home Assistant has no sun.sun data).',
  },
  'gs.moon_status_low': {
    ru: 'Сейчас: не показывается (луна на высоте {alt}°, видна от 3° над горизонтом).',
    en: 'Now: not shown (the moon is at {alt}°; it shows from 3° above the horizon).',
  },
  'gs.moon_status_new': {
    ru: 'Сейчас: не показывается (новолуние, освещено {pct}\u00a0%, видна от 3\u00a0%).',
    en: 'Now: not shown (new moon, {pct}% lit; it shows from 3%).',
  },
};

test('#718 AC14: seven keys in all four dictionaries, one placeholder set, RU and EN as specified', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, expected] of Object.entries(MOON_KEYS)) {
    const reference = placeholders(expected.en);
    for (const lang of ['en', 'ru', 'de', 'fr']) {
      const text = json(`src/i18n/settings/${lang}.json`)[key];
      assert.ok(typeof text === 'string' && text.trim(), `${lang} ${key}`);
      assert.deepEqual(placeholders(text), reference, `${lang} ${key}: placeholders`);
    }
    assert.equal(json('src/i18n/settings/ru.json')[key], expected.ru, `ru ${key}`);
    assert.equal(json('src/i18n/settings/en.json')[key], expected.en, `en ${key}`);
  }
  // #502: called by literal, never as `gs.moon_status_${reason}`.
  const source = read('src/editors/moon-status.ts');
  for (const reason of ['shown', 'no_home', 'day_sun', 'day_clock', 'low', 'new']) {
    assert.match(source, new RegExp(`'gs\\.moon_status_${reason}'`));
  }
  assert.doesNotMatch(source, /gs\.moon_status_\$\{/);
});

function dialogHost(hass) {
  return {
    hass,
    updates: 0,
    _settingsDialog: { moon: true, bgMode: 'static', busy: false, glowRadiusInput: '3', northDegInput: '' },
    requestUpdate() { this.updates++; },
  };
}
const NIGHT = { azimuth: 0, elevation: -12, rising: false };
const hassWith = (sun) => ({
  config: { latitude: 55.75, longitude: 37.62 },
  states: sun ? { 'sun.sun': { attributes: sun } } : {},
});
const settle = () => new Promise((done) => setTimeout(done, 300));

test('#718 K7: one snapshot per opening, outside the draft; a closed opening’s result is dropped', async () => {
  const at = new Date('2026-10-21T18:00:00Z');
  const host = dialogHost(hassWith(NIGHT));
  const draftKey = generalDraftKey(host._settingsDialog);
  // First opening: the chunk is not here yet, and the dialog closes before it arrives.
  openMoonStatus(host, at);
  assert.equal(moonStatusOf(host), undefined, 'no line while the chunk loads');
  host._settingsDialog = null;
  await settle();
  assert.equal(moonStatusOf(host), undefined, 'the closed opening’s result is dropped');
  assert.equal(host.updates, 0);
  // Second opening after the sun rose: its own snapshot, at once (the chunk is here now).
  host._settingsDialog = dialogHost()._settingsDialog;
  host.hass = hassWith({ azimuth: 180, elevation: 40, rising: false });
  openMoonStatus(host, at);
  assert.deepEqual(moonStatusOf(host), { reason: 'day_sun', sun: 40 });
  assert.equal(host.updates, 1);
  // The snapshot is the opening's: a later state update does not change it.
  host.hass = hassWith(NIGHT);
  assert.deepEqual(moonStatusOf(host), { reason: 'day_sun', sun: 40 });
  // The line is not part of the draft: its key is unchanged, the dialog is not dirty.
  assert.equal(generalDraftKey(host._settingsDialog), draftKey);
  // Night and the switch off in the draft: the status is still what «on» would show.
  host._settingsDialog = { ...host._settingsDialog, moon: false };
  openMoonStatus(host, at);
  assert.deepEqual(moonStatusOf(host), { reason: 'shown', alt: 24, pct: 79 });
  // No sun.sun: the clock decides — midday is day by the clock.
  host.hass = hassWith(null);
  openMoonStatus(host, new Date(2026, 9, 21, 12, 0));
  assert.deepEqual(moonStatusOf(host), { reason: 'day_clock' });
});

test('#731 AC2: a warm revive is a new opening — its own snapshot, nothing carried over, the draft untouched', async () => {
  const at = new Date('2026-10-21T18:00:00Z');
  // The instance Lovelace replaced: opened at night, judged, its draft clean.
  const dead = dialogHost(hassWith(NIGHT));
  rememberGeneralBaseline(dead, dead._settingsDialog);
  openMoonStatus(dead, at);
  await settle();
  assert.deepEqual(moonStatusOf(dead), { reason: 'shown', alt: 24, pct: 79 });
  // Its successor, as `_warmReviveDialog` hands the dialog over — the draft
  // copied, the baseline restored — after the sun has risen.
  const live = dialogHost(hassWith({ azimuth: 180, elevation: 40, rising: false }));
  live._settingsDialog = { ...dead._settingsDialog, busy: false };
  restoreWarmDialogBaseline(live, 'settings', warmDialogBaseline(dead, 'settings'));
  assert.equal(moonStatusOf(live), undefined, 'the dead opening’s result is not carried over');
  const key = generalDraftKey(live._settingsDialog);
  assert.equal(generalDirty(live, live._settingsDialog), false);
  // The revive's own opening (the runtime's `_openMoonStatus`): the snapshot of now.
  openMoonStatus(live, at);
  assert.deepEqual(moonStatusOf(live), { reason: 'day_sun', sun: 40 });
  assert.equal(live.updates, 1);
  assert.equal(generalDraftKey(live._settingsDialog), key, 'the line stays outside the draft');
  assert.equal(generalDirty(live, live._settingsDialog), false, 'the line does not make it dirty');
  // A dirty draft travels the same way: the line does not clean it either.
  live._settingsDialog = { ...live._settingsDialog, moon: false };
  openMoonStatus(live, at);
  assert.equal(generalDirty(live, live._settingsDialog), true);
  // The same element re-attached: its earlier opening is replaced, not reused.
  live.hass = hassWith(NIGHT);
  openMoonStatus(live, at);
  assert.deepEqual(moonStatusOf(live), { reason: 'shown', alt: 24, pct: 79 });
});
