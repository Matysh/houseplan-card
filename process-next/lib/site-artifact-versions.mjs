import { listZipEntries, readZipEntries } from './zip.mjs';

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
  if (distribution.product_version !== version || distribution.version !== version ||
      values('Version').length !== 1 || values('Version')[0] !== version ||
      values('Name').length !== 1 || values('Name')[0] !== 'houseplan-core' ||
      integration.version !== version || frontend.version !== version ||
      frontend.product !== 'houseplan-standalone' || frontend.schema !== 1)
    throw Error('Wheel, HA manifest and standalone ZIP versions must match the release');
  const hacsFrontend = jsonMember(hacs, 'frontend/houseplan-assets.json');
  if (frontend.source?.commit !== sha || frontend.source?.fingerprint !== fingerprint ||
      frontend.source?.dirty !== false || hacsFrontend.fingerprint !== fingerprint)
    throw Error('Site artifact source identity must match the release');
}
