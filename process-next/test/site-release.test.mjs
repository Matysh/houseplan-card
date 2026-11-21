import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { preparePublicationArtifacts } from '../lib/release-preparation.mjs';
import { appendSiteReleaseNotes, SITE_RELEASE_NOTES, siteReleasePaths, siteReleasePublication } from '../lib/site-release.mjs';
import { digest, outputIdentity } from '../lib/storage.mjs';

const sha = 'a'.repeat(40), version = '1.86.0', tag = 'v'+version;
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-site-release-test-'));
  t.after(() => rmSync(root, { recursive:true, force:true }));
  const paths = siteReleasePaths(sha, version);
  const write = (name, bytes) => {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive:true }); writeFileSync(path, bytes);
    return { name: name.split('/').at(-1), bytes: Buffer.byteLength(bytes), sha256:digest(bytes) };
  };
  const zip = 'artifacts/houseplan.zip', standalone = 'artifacts/houseplan-card.js';
  const hacs = write(zip, 'unchanged HACS');
  const packageResult = { version, sourceSha:sha, zip, standalone, artifactDigest:hacs.sha256,
    standaloneDigest:write(standalone, 'checked HACS entry').sha256 };
  const manifest = { schema:1, version, tag, sourceSha:sha, sourceFingerprint:'f'.repeat(64),
    compatibility:{ modelVersion:11, spaceExportVersion:3, houseExportVersion:4,
      houseRequiredApi:{house_transfer_api:1}, houseOptionalApi:{furniture_workstation_api:1},
      python:'>=3.14', firstStableWithHouseImport:'1.86.0' },
    assets:[write(paths.outputs[0], 'checked wheel'), write(paths.outputs[1], 'checked zipped tree'), hacs] };
  const candidate = { kind:'stable', sha, tag, membership:{schema:1, candidate:sha, base:null,
    issues:[{number:1465, commits:[sha]}]}, runner:{} };
  const bind = () => {
    write(paths.outputs[2], JSON.stringify(manifest));
    candidate.runner.siteReleaseOutputHash = outputIdentity(root, paths.outputs).hash;
  };
  bind();
  return { root, paths, manifest, candidate, packageResult, write, bind,
    read: () => siteReleasePublication(root,candidate,packageResult) };
}

test('ordinary stable publishes its exact checked pair and metadata without changing HACS', t => {
  const f = fixture(t);
  const [wheel, editor, facts] = f.read().assets;
  assert.deepEqual([wheel.name,editor.name,facts.name], [f.paths.wheel,f.paths.editor,f.paths.manifest]);
  const body = 'Authored RU and EN, unmodified.';
  const published = appendSiteReleaseNotes(body,f.manifest);
  assert.ok(published.startsWith(body + '\n\n' + SITE_RELEASE_NOTES));
  assert.match(published, /house ZIP: 4/);
  assert.match(published, /later versions must be checked/);
  const publish = () => preparePublicationArtifacts(f);
  const original = readFileSync(join(f.root,f.packageResult.zip));
  const a = publish(), b = publish();
  assert.deepEqual(a,b);
  assert.deepEqual(readFileSync(join(f.root,f.packageResult.zip)),original);
  const sums = readFileSync(a.at(-1).path,'utf8');
  for (const {name,expectedDigest} of a.slice(0,-1)) assert.ok(sums.includes(expectedDigest+'  '+name));
});

test('a wrong version, source, hash, HACS stamp, or missing output cannot publish', t => {
  const f = fixture(t);
  const hash = f.candidate.runner.siteReleaseOutputHash;
  delete f.candidate.runner.siteReleaseOutputHash;
  assert.throws(f.read,/missing or changed/);
  f.candidate.runner.siteReleaseOutputHash = hash;
  f.manifest.version = '1.86.1'; f.bind();
  assert.throws(f.read,/does not identify/);
  f.manifest.version = version; f.manifest.sourceSha = 'b'.repeat(40); f.bind();
  assert.throws(f.read,/does not identify/);
  f.manifest.sourceSha = sha; f.bind();
  f.write(f.packageResult.zip, 'different HACS');
  assert.throws(f.read,/verified bytes: houseplan.zip/);
  f.write(f.packageResult.zip, 'unchanged HACS');
  f.write(f.paths.outputs[0], 'different wheel');
  assert.throws(f.read,/missing or changed/);
  rmSync(join(f.root,f.paths.outputs[1]));
  assert.throws(f.read,/missing or changed/);
});

test('beta and hotfix do not consume a site pair', t => {
  const f = fixture(t);
  delete f.candidate.runner.siteReleaseOutputHash;
  for (const kind of ['beta', 'hotfix']) {
    f.candidate.kind = kind;
    const names = preparePublicationArtifacts(f).map(asset=>asset.name);
    assert.deepEqual(names,['houseplan.zip','houseplan-card.js','RELEASE-MEMBERSHIP.json','SHA256SUMS']);
  }
});
