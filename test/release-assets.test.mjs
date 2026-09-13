// #540: паспорт установочных ассетов — публикуются ровно те байты, что прошли гейты.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  INSTALLABLE_ASSETS, PASSPORTED_ASSETS, SUMS_FILE, compareSums, formatSums, parseSums,
  sha256Hex, sumsOfDirectory,
} from '../scripts/release-assets.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

test('#540/#547: installables stay two while the passport also binds release membership', () => {
  assert.deepEqual(INSTALLABLE_ASSETS, ['houseplan-card.js', 'houseplan.zip']);
  assert.deepEqual(PASSPORTED_ASSETS, [
    'houseplan-card.js', 'houseplan.zip', 'RELEASE-MEMBERSHIP.json',
  ]);
  assert.equal(SUMS_FILE, 'SHA256SUMS');
  const text = formatSums({ 'houseplan.zip': A, 'houseplan-card.js': B });
  assert.equal(text, `${B}  houseplan-card.js\n${A}  houseplan.zip\n`);
  assert.deepEqual(parseSums(text), { 'houseplan-card.js': B, 'houseplan.zip': A });
  assert.deepEqual(parseSums(`${A} *houseplan.zip\r\n`), { 'houseplan.zip': A }, 'binary marker and CRLF tolerated');
  assert.throws(() => formatSums({}), /нет ни одного/);
  assert.throws(() => parseSums(''), /пустой/);
  assert.throws(() => parseSums('deadbeef  x'), /непонятная/);
  assert.throws(() => parseSums(`${A}  x\n${B}  x\n`), /дважды/);
});

test('#540 AC3: a present asset with another hash is a mismatch — never a silent replacement; an absent one is merely missing', () => {
  const expected = { 'houseplan-card.js': B, 'houseplan.zip': A };
  assert.deepEqual(compareSums(expected, { 'houseplan-card.js': B, 'houseplan.zip': A }),
    { ok: true, missing: [], mismatched: [], extra: [] });
  assert.deepEqual(compareSums(expected, { 'houseplan-card.js': B }),
    { ok: false, missing: ['houseplan.zip'], mismatched: [], extra: [] }, 'repair may add what is missing');
  assert.deepEqual(compareSums(expected, { 'houseplan-card.js': B, 'houseplan.zip': C }),
    { ok: false, missing: [], mismatched: ['houseplan.zip'], extra: [] }, 'v1.75.0 class: public bytes differ from the verified ones');
  assert.deepEqual(compareSums(expected, { 'houseplan-card.js': B, 'houseplan.zip': A, 'extra.bin': C }).extra, ['extra.bin']);
});

test('#540: the CLI writes the passport from real files and refuses an incomplete set; check exits 1 on a mismatch', () => {
  const script = fileURLToPath(new URL('../scripts/release-assets.mjs', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'hp-release-assets-'));
  try {
    writeFileSync(join(dir, 'houseplan-card.js'), 'card');
    let r = spawnSync(process.execPath, [script, 'sums', dir], { encoding: 'utf8' });
    assert.equal(r.status, 1, 'no passport for a half set');
    assert.match(r.stderr, /houseplan\.zip отсутствует/);

    writeFileSync(join(dir, 'houseplan.zip'), 'zip');
    r = spawnSync(process.execPath, [script, 'sums', dir, '--include-membership'], { encoding: 'utf8' });
    assert.equal(r.status, 1, 'candidate membership is part of a prerelease passport');
    assert.match(r.stderr, /RELEASE-MEMBERSHIP\.json отсутствует/);

    writeFileSync(join(dir, 'RELEASE-MEMBERSHIP.json'), '{"schema":1}\n');
    r = spawnSync(process.execPath, [script, 'sums', dir, '--include-membership'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const sums = readFileSync(join(dir, SUMS_FILE), 'utf8');
    assert.deepEqual(parseSums(sums), {
      'houseplan-card.js': sha256Hex(Buffer.from('card')),
      'houseplan.zip': sha256Hex(Buffer.from('zip')),
      'RELEASE-MEMBERSHIP.json': sha256Hex(Buffer.from('{"schema":1}\n')),
    });
    assert.deepEqual(sumsOfDirectory(dir, PASSPORTED_ASSETS), parseSums(sums));

    r = spawnSync(process.execPath, [script, 'check', dir, join(dir, SUMS_FILE)], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);

    writeFileSync(join(dir, 'houseplan.zip'), 'other bytes');
    r = spawnSync(process.execPath, [script, 'check', dir, join(dir, SUMS_FILE)], { encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /MISMATCH houseplan\.zip/);
    assert.match(r.stderr, /хеш расходится: houseplan\.zip/);

    rmSync(join(dir, 'houseplan.zip'));
    r = spawnSync(process.execPath, [script, 'check', dir, join(dir, SUMS_FILE)], { encoding: 'utf8' });
    assert.equal(r.status, 1, 'missing is a failure by default');
    r = spawnSync(process.execPath, [script, 'check', dir, join(dir, SUMS_FILE), '--allow-missing'], { encoding: 'utf8' });
    assert.equal(r.status, 0, 'repair mode tolerates a missing asset — it will be added');
    assert.match(r.stdout, /missing {2}houseplan\.zip/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
