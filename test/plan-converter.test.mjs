import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CONVERTER, planConverterFormats } from '../test-build/plan-converter.js';
import { CONVERTER_DICTIONARIES, converterT } from '../test-build/i18n/converter.js';

test('#1020: both presentations and general settings project one canonical converter', () => {
  assert.equal(PLAN_CONVERTER.url, 'https://houseplan.tech/convert/');
  assert.equal(planConverterFormats(), 'Sweet Home 3D (.sh3d), Easy Floorplan (YAML / JSON)');
  const formats = [...PLAN_CONVERTER.formats, { name: 'Future long format', extensions: ['.extra', '.other'] }];
  assert.equal(planConverterFormats(formats, '; '),
    'Sweet Home 3D (.sh3d); Easy Floorplan (YAML / JSON); Future long format (.extra / .other)');
  assert.equal(PLAN_CONVERTER.formats.length, 2, 'ordinary formatter input does not mutate the shared source');
});

test('#1020: all four lazy dictionaries preserve segmented text and format interpolation', () => {
  const keys = Object.keys(CONVERTER_DICTIONARIES.en).sort();
  for (const [lang, dict] of Object.entries(CONVERTER_DICTIONARIES)) {
    assert.deepEqual(Object.keys(dict).sort(), keys, lang);
    assert.ok(converterT(lang, 'converter_hint.before_link').trim(), lang);
    assert.ok(converterT(lang, 'converter_hint.link').trim(), lang);
    assert.ok(converterT(lang, 'converter_hint.after_link').trim(), lang);
    const text = converterT(lang, 'converter_hint.supported_formats', { formats: 'Extra (.extra)' });
    assert.ok(text.includes('Extra (.extra)'), lang);
    assert.doesNotMatch(text, /\{formats\}/);
    assert.ok(!JSON.stringify(dict).includes('https://'), 'URL belongs to the canonical data');
    assert.ok(!JSON.stringify(dict).includes('Sweet Home'), 'format names belong to the canonical data');
  }
});
