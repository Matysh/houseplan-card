// #661 AC10: the moon switch in General settings — «Sun and Moon» section,
// reset to on, save writes `true` or removes the key; its strings exist in all
// four dictionaries. The dialog is a lazy Lit module (its layout is read as a
// source contract); reading and writing the key are executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moonDraftOf, writeMoonSetting } from '../test-build/editors/general-form-state.js';

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
  assert.match(row, /title: st\('gs\.moon'\), caption: st\('gs\.moon_hint'\)/);
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
