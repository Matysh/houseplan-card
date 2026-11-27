import { listZipEntries, readZipEntries } from './zip.mjs';

// Product releases use three numeric parts and optional alpha/beta/rc.N.
// Compare the equivalent PEP 440 wheel spelling, rather than treating beta.2
// and b2 as different releases. This is not an arbitrary PEP 440 parser.
function canonicalVersion(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:(?:-(alpha|beta|rc)\.(\d+))|(?:(a|b|rc)(\d+)))?$/.exec(value);
  if (!match) return null;
  const release = match.slice(1,4).map(part => BigInt(part).toString()).join('.');
  const channel = ({alpha:'a',beta:'b',rc:'rc'})[match[4]] ?? match[6] ?? '';
  return release + channel + (channel ? BigInt(match[5] ?? match[7]).toString() : '');
}

const jsonMember = (path, name) => JSON.parse(readZipEntries(path, [name]).get(name).toString('utf8'));

/** Read the frozen artifacts again at publish, rather than trusting filenames
 * or the build receipt. Called before GitHub creates/uploads any release. */
export function verifySiteArtifactVersions({ wheel, editor, hacs, version, sha, fingerprint }) {
  const distribution = jsonMember(wheel, 'houseplan_core/distribution.json');
  const metadata = listZipEntries(wheel).filter(name => /^[^/]+\.dist-info\/METADATA$/.test(name));
  if (metadata.length !== 1) throw Error('Expected one core wheel METADATA');
  const fields = readZipEntries(wheel, metadata).get(metadata[0]).toString('utf8');
  const values = name => [...fields.matchAll(new RegExp('^' + name + ': ([^\\r\\n]+)', 'gm'))].map(match => match[1]);
  const frontend = jsonMember(editor, 'houseplan-standalone-manifest.json');
  const integration = jsonMember(hacs, 'manifest.json');
  const expected = canonicalVersion(version);
  const versions = [distribution.product_version, distribution.version,
    values('Version')[0], integration.version, frontend.version];
  if (!expected || versions.some(value => canonicalVersion(value) !== expected) ||
      values('Version').length !== 1 ||
      values('Name').length !== 1 || values('Name')[0] !== 'houseplan-core' ||
      frontend.product !== 'houseplan-standalone' || frontend.schema !== 1)
    throw Error('Wheel, HA manifest and standalone ZIP versions must match the release');
  const hacsFrontend = jsonMember(hacs, 'frontend/houseplan-assets.json');
  if (frontend.source?.commit !== sha || frontend.source?.fingerprint !== fingerprint ||
      frontend.source?.dirty !== false || hacsFrontend.fingerprint !== fingerprint)
    throw Error('Site artifact source identity must match the release');
}
