import test from 'node:test';
import assert from 'node:assert/strict';
import { stackedFieldChecks } from '../demo/helpers/stacked-fields.mjs';

const rect = (left, top, width, height) => ({ left, top, width, height,
  right: left + width, bottom: top + height });
const layout = () => ({ container: rect(14, 96, 292, 181), fields: [
  { field: rect(14, 96, 292, 71), control: rect(14, 123, 292, 44) },
  { field: rect(14, 204, 292, 73), control: rect(14, 233, 292, 44) },
] });

test('stacked fields accept actual narrow boxes and translated/subpixel desktop boxes', () => {
  for (const width of [292, 362, 452, 494.375, 382]) {
    const m = layout();
    for (const r of [m.container, ...m.fields.flatMap(({field,control}) => [field,control])]) {
      Object.assign(r, rect(r.left + 21.125, r.top - 80.5, width, r.height));
    }
    assert.ok(Object.values(stackedFieldChecks(m)).every(Boolean));
  }
});

test('stacked fields reject side-by-side columns and reversed field order', () => {
  const m = layout();
  m.fields[0] = { field: rect(14,96,130,71), control: rect(14,123,130,44) };
  m.fields[1] = { field: rect(176,96,130,73), control: rect(176,125,130,44) };
  assert.equal(stackedFieldChecks(m).fullWidth, false);
  assert.equal(stackedFieldChecks(m).ordered, false);
  assert.equal(stackedFieldChecks(m).sectionSpacing, false);
  assert.equal(stackedFieldChecks({ ...layout(), fields: layout().fields.reverse() }).ordered, false);
});

test('stacked fields reject missing, hidden and non-finite geometry', () => {
  for (const change of [
    m => { m.fields.pop(); },
    m => { m.fields = []; },
    m => { m.fields[1].field.height = 0; },
    m => { m.fields[1].control.width = 0; },
    m => { m.container.width = 0; },
    m => { m.fields[0].field.top = NaN; },
  ]) {
    const m = layout(); change(m);
    assert.ok(Object.values(stackedFieldChecks(m)).every(value => value === false));
  }
});

test('stacked fields reject overlaps, lost divider spacing and excessive spacing', () => {
  for (const gap of [-1, 0, 12, 18, 35, 39, 74]) {
    const m = layout();
    m.fields[1].field = rect(14, m.fields[0].field.bottom + gap, 292, 73);
    assert.equal(stackedFieldChecks(m).sectionSpacing, false, `gap ${gap}`);
  }
});

test('stacked fields reject shifted/narrow fields, narrow controls and escaped controls', () => {
  for (const change of [
    m => { m.fields[1].field = rect(16,204,290,73); },
    m => { m.fields[0].control = rect(14,123,130,44); },
    m => { m.fields[0].control = rect(14,95,292,44); },
    m => { m.fields[1].control = rect(14,250,292,44); },
    m => { m.container = rect(14,96,292,100); },
  ]) {
    const m = layout(); change(m);
    assert.ok(Object.values(stackedFieldChecks(m)).some(value => value === false));
  }
});
