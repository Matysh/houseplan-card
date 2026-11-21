import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { digest, outputIdentity, within } from './storage.mjs';

const hash = /^[a-f0-9]{64}$/;
export const SITE_RELEASE_STEP = 'site-release';
export const SITE_RELEASE_NOTES = '<!-- houseplan-site-distribution:v1 -->';
export const ordinaryStableVersion = value => /^\d+\.\d+\.\d+$/.test(value);

export function siteReleasePaths(sha, version) {
  if (!/^[a-f0-9]{40}$/.test(sha) || !ordinaryStableVersion(version)) throw Error('Expected a stable source SHA and version');
  const directory = 'artifacts/process-next/site-release/' + sha;
  const manifest = 'houseplan-site-' + version + '.json';
  const wheel = 'houseplan_core-' + version + '-py3-none-any.whl';
  const editor = 'houseplan-standalone-' + version + '.zip';
  return { directory, manifest, wheel, editor, outputs: [wheel, editor, manifest].map(name => directory+'/'+name) };
}

function checkedFacts(root, identity, paths, hacs) {
  const path = within(root, resolve(root, paths.directory, paths.manifest));
  const content = readFileSync(path);
  const manifest = JSON.parse(content);
  if (manifest.schema !== 1 || manifest.tag !== identity.tag || manifest.version !== identity.version ||
      manifest.sourceSha !== identity.sha || !hash.test(manifest.sourceFingerprint ?? ''))
    throw Error('Standalone release manifest does not identify this stable candidate');
  const c = manifest.compatibility;
  if (!c || !['modelVersion','spaceExportVersion','houseExportVersion'].every(key => Number.isSafeInteger(c[key]) && c[key] > 0)
      || !/^\d+\.\d+\.\d+$/.test(c.firstStableWithHouseImport ?? '') || !c.python ||
      !Number.isSafeInteger(c.houseRequiredApi?.house_transfer_api) ||
      !Number.isSafeInteger(c.houseOptionalApi?.furniture_workstation_api))
    throw Error('Incomplete site release compatibility facts');
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 3) throw Error('Incomplete site release asset set');
  const rows = new Map(manifest.assets.map(row => [row.name, row]));
  const entries = [[paths.wheel, resolve(root, paths.directory, paths.wheel)],
    [paths.editor, resolve(root, paths.directory, paths.editor)], ['houseplan.zip', hacs.path]];
  const assets = entries.map(([name, file]) => {
    const bytes = readFileSync(within(root, file)), fact = rows.get(name);
    if (!fact || fact.bytes !== bytes.length || fact.sha256 !== digest(bytes) ||
        (name === 'houseplan.zip' && hacs.sha256 !== fact.sha256))
      throw Error('Standalone release asset differs from its verified bytes: ' + name);
    return { name, path: file, expectedDigest: fact.sha256 };
  });
  return { manifest, assets: [...assets.slice(0,2), { name: paths.manifest, path, expectedDigest: digest(content) }] };
}

export function siteReleasePublication(root, candidate, packageResult) {
  const paths = siteReleasePaths(candidate.sha, packageResult.version);
  const immutable = outputIdentity(root, paths.outputs);
  if (!immutable.complete || !candidate.runner?.siteReleaseOutputHash ||
      immutable.hash !== candidate.runner.siteReleaseOutputHash)
    throw Error('The tested standalone release asset set is missing or changed');
  return checkedFacts(root, { sha: candidate.sha, tag: candidate.tag, version: packageResult.version }, paths,
    { path: resolve(root, packageResult.zip), sha256: packageResult.artifactDigest });
}

/** The public metadata block is mechanical and separate from authored announcements. */
export function appendSiteReleaseNotes(body, manifest) {
  if (body.includes(SITE_RELEASE_NOTES)) throw Error('Site distribution notes already present');
  const c = manifest.compatibility;
  const names = manifest.assets.filter(row => row.name !== 'houseplan.zip').map(row => row.name);
  return body + '\n\n' + SITE_RELEASE_NOTES + '\n\n' + '## Поставка для сайта / Website distribution\n\n'
    + 'Коммит / Commit: `' + manifest.sourceSha + '`\n\n'
    + names.map(name => '- ' + name).join('\n') + '\n- houseplan-site-' + manifest.version + '.json (SHA-256)\n\n'
    + '**RU.** Модель плана: ' + c.modelVersion + '; JSON пространства: ' + c.spaceExportVersion
    + '; ZIP дома: ' + c.houseExportVersion + '; Python: ' + c.python + '. '
    + 'Импорт ZIP дома требует совпадения модели, формата и API из манифеста. Первый stable с импортом: '
    + c.firstStableWithHouseImport + '; это не гарантия совместимости со всеми следующими версиями.\n\n'
    + '**EN.** Plan model: ' + c.modelVersion + '; space JSON: ' + c.spaceExportVersion
    + '; house ZIP: ' + c.houseExportVersion + '; Python: ' + c.python + '. '
    + 'House import requires the model, format and API in the manifest. First stable with house import: '
    + c.firstStableWithHouseImport + '; later versions must be checked for compatibility.\n';
}
