import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { composeUserStableNotes, userStableSection } from '../../scripts/user-stable-changelog.mjs';
import { buildCandidateMembership, membershipIssueNumbers } from './release-data.mjs';
import { digest, within } from './storage.mjs';

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const jsonFiles = ['package.json', 'package-lock.json', 'custom_components/houseplan/manifest.json'];
const sourceFiles = [
  ['custom_components/houseplan/const.py', /^(VERSION\s*=\s*)["'][^"']+["']/m],
  ['src/houseplan-card.ts', /(\bCARD_VERSION\s*=\s*)["'][^"']+["']/],
  ['src/houseplan-editor-runtime.ts', /(\bCARD_VERSION\s*=\s*)["'][^"']+["']/],
];

/** Explicit author preparation before committing/testing a release; no Git, tests or publication. */
export function prepareReleaseVersions({ root, version, write = false }) {
  if (!versionPattern.test(version ?? '')) throw Error('A release version X.Y.Z[-beta.N] is required');
  const changes = [];
  for (const path of jsonFiles) {
    const before = readFileSync(join(root, path), 'utf8'), value = JSON.parse(before);
    value.version = version;
    if (path === 'package-lock.json') {
      if (!value.packages?.['']) throw Error('package-lock.json has no root package');
      value.packages[''].version = version;
    }
    const after = JSON.stringify(value, null, 2) + '\n';
    if (after !== before.replace(/\r\n/g, '\n')) changes.push({ path, before, after });
  }
  for (const [path, pattern] of sourceFiles) {
    const before = readFileSync(join(root, path), 'utf8');
    if (!pattern.test(before)) throw Error(`Version declaration missing in ${path}`);
    const after = before.replace(pattern, (_, prefix) => `${prefix}'${version}'`);
    if (after !== before) changes.push({ path, before, after });
  }
  // Read every source before changing any file; malformed input cannot leave a partial bump.
  if (write) for (const change of changes) writeFileSync(join(root, change.path), change.after);
  return { version, written: write, files: changes.map(({ path }) => path) };
}

export function technicalChangelogSection(text, tag) {
  const lines = String(text).split(/\r?\n/);
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = lines.findIndex(line => new RegExp(`^## ${escaped}(?:\\s|$)`).test(line));
  if (start < 0) throw Error(`Author the technical changelog section for ${tag}`);
  const next = lines.findIndex((line, index) => index > start && /^## /.test(line));
  const section = lines.slice(start, next < 0 ? undefined : next).join('\n').trim();
  if (!section.split('\n').slice(1).join('\n').trim()) throw Error(`The technical changelog section for ${tag} is empty`);
  return section;
}

/** Read author-written prose from the candidate. Never draft, classify or summarize it. */
export async function readAuthoredReleaseTexts({ read, kind, tag }) {
  if (!['beta', 'stable', 'hotfix'].includes(kind) || !versionPattern.test(String(tag ?? '').replace(/^v/, '')))
    throw Error('Release kind and tag are required');
  const technical = {
    ru: technicalChangelogSection(await read('docs/CHANGELOG.ru.md'), tag),
    en: technicalChangelogSection(await read('docs/CHANGELOG.md'), tag),
  };
  if (kind === 'beta') {
    const body = String(await read('docs/RELEASE-NOTES.md')).trim();
    if (!body || !body.includes(`<!-- release: ${tag} -->`)) throw Error(`Author the beta RELEASE-NOTES for ${tag} before publication`);
    return { body: body + '\n', technical, userChangelog: null };
  }
  const userChangelog = {};
  for (const [language, path] of [['ru', 'docs/changelog_user_stable_ru.md'], ['en', 'docs/changelog_user_stable_en.md']]) {
    const section = userStableSection(await read(path), { tag, language });
    userChangelog[language] = `<!-- release: ${tag} -->\n<!-- base: ${section.baseStable} -->\n${section.body}\n`;
  }
  return { body: composeUserStableNotes({ changelogRu: userChangelog.ru, changelogEn: userChangelog.en, tag }), technical, userChangelog };
}

/** Collect exact source facts for creation/fix and publication. No remote mutations. */
export async function prepareReleaseData({ git, candidateSha, baseSha = null, kind, tag, texts = true, tasks = [], previousMembership }) {
  const membership = await buildCandidateMembership({ git, candidateSha, baseSha, tag, tasks, previousMembership });
  const includedIssues = membershipIssueNumbers(membership, candidateSha);
  const result = { membership, includedIssues };
  if (texts) {
    const version = JSON.parse(await git.git(['show', `${candidateSha}:package.json`])).version;
    if (version !== String(tag).replace(/^v/, '')) throw Error('Release tag differs from the prepared candidate version');
    Object.assign(result, { version }, await readAuthoredReleaseTexts({ kind, tag,
      read: path => git.git(['show', `${candidateSha}:${path}`]) }));
  }
  return result;
}

/** The stable release body is a copy of authored RU/EN sections, not generated prose. */
export async function prepareReleaseNotes({ root, kind, tag, write = false }) {
  const result = await readAuthoredReleaseTexts({ kind, tag, read: path => readFileSync(join(root, path), 'utf8') });
  if (write && kind !== 'beta') writeFileSync(join(root, 'docs/RELEASE-NOTES.md'), result.body);
  return { ...result, written: write && kind !== 'beta' };
}

/** Prepare the public files from the already-tested package, without rebuilding it. */
export function preparePublicationArtifacts({ root, packageResult, candidate, output = join(root, 'artifacts/process-next/publication') }) {
  root = resolve(root); output = within(root, resolve(output));
  if (packageResult.sourceSha !== candidate.sha) throw Error('Prepared package belongs to another candidate');
  membershipIssueNumbers(candidate.membership, candidate.sha);
  if (!candidate.tag || candidate.membership.tag && candidate.membership.tag !== candidate.tag)
    throw Error('Membership tag differs from the publication');
  mkdirSync(output, { recursive: true });
  const assets = [
    { name: 'houseplan.zip', path: within(root, resolve(root, packageResult.zip)) },
    { name: 'houseplan-card.js', path: within(root, resolve(root, packageResult.standalone ?? join(packageResult.candidateRoot, 'custom_components/houseplan/frontend/houseplan-card.js'))) },
  ];
  const membershipPath = join(output, 'RELEASE-MEMBERSHIP.json');
  writeFileSync(membershipPath, JSON.stringify({ ...candidate.membership, tag: candidate.tag }, null, 2) + '\n');
  assets.push({ name: 'RELEASE-MEMBERSHIP.json', path: membershipPath });
  for (const asset of assets) asset.expectedDigest = digest(readFileSync(asset.path));
  if (assets[0].expectedDigest !== packageResult.artifactDigest) throw Error('Prepared ZIP changed after testing');
  const expectedStandalone = packageResult.standaloneDigest
    ?? packageResult.files?.find(file => file.path === 'custom_components/houseplan/frontend/houseplan-card.js')?.digest;
  if (!expectedStandalone || assets[1].expectedDigest !== expectedStandalone) throw Error('Prepared public JS changed after packaging');
  const sums = assets.map(asset => `${asset.expectedDigest}  ${asset.name}`).sort().join('\n') + '\n';
  const sumsPath = join(output, 'SHA256SUMS'); writeFileSync(sumsPath, sums);
  assets.push({ name: 'SHA256SUMS', path: sumsPath, expectedDigest: digest(sums) });
  return assets;
}
