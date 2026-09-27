import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  guideHeadingProfile,
  guideParityErrors,
  guideVersion,
} from '../scripts/user-guide-parity.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('#668: English and Russian user guides keep the same structure and version', () => {
  const english = read('docs/USER-GUIDE.md');
  const russian = read('docs/USER-GUIDE.ru.md');
  assert.deepEqual(guideParityErrors(english, russian), []);
  assert.equal(guideHeadingProfile(english).filter(({ section }) => section).length, 23);
  assert.equal(guideVersion(english, 'en'), guideVersion(russian, 'ru'));
});

test('#668: removing a subsection makes the parity guard fail', () => {
  const english = '## 1. One\n### Detail\n## 2. Two\n';
  const russian = '## 1. Один\n## 2. Два\n';
  assert.match(guideParityErrors(english, russian).join('\n'), /heading profiles differ/);
});

test('#668: changing a subsection level makes the parity guard fail', () => {
  const english = '## 1. One\n### Detail\n';
  const russian = '## 1. Один\n#### Деталь\n';
  assert.match(guideParityErrors(english, russian).join('\n'), /heading profiles differ/);
});

test('#668: different guide version markers make the parity guard fail', () => {
  const english = 'Current for **v1.2.3**.\n';
  const russian = 'Актуально для **v1.2.4**.\n';
  assert.match(guideParityErrors(english, russian).join('\n'), /current versions differ/);
});
