import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function versionFromTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v'))
    throw new Error(`Release tag must start with v: ${String(tag)}`);
  const version = tag.slice(1);
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Release tag is not valid SemVer: ${tag}`);
  if (match[4]?.split('.').some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))
    throw new Error(`Numeric prerelease identifiers must not contain leading zeroes: ${tag}`);
  return { version, prerelease: !!match[4] };
}

export function parseVersionSources({ packageJson, packageLock, manifest, constSource, cardSource }) {
  const pkg = JSON.parse(packageJson);
  const lock = JSON.parse(packageLock);
  const integration = JSON.parse(manifest);
  const constMatch = /^VERSION\s*=\s*["']([^"']+)["']/m.exec(constSource);
  const cardMatch = /\bCARD_VERSION\s*=\s*["']([^"']+)["']/m.exec(cardSource);
  if (!constMatch) throw new Error('VERSION is missing from custom_components/houseplan/const.py');
  if (!cardMatch) throw new Error('CARD_VERSION is missing from src/houseplan-card.ts');
  return {
    'package.json': pkg.version,
    'package-lock.json': lock.version,
    'package-lock.json packages[""]': lock.packages?.['']?.version,
    'custom_components/houseplan/manifest.json': integration.version,
    'custom_components/houseplan/const.py': constMatch[1],
    'src/houseplan-card.ts': cardMatch[1],
  };
}

export function validateVersionSources(tag, sources, { requirePrerelease = true } = {}) {
  const parsed = versionFromTag(tag);
  if (requirePrerelease && !parsed.prerelease)
    throw new Error(`Prerelease publication requires a prerelease SemVer tag: ${tag}`);
  const mismatches = Object.entries(sources)
    .filter(([, value]) => value !== parsed.version)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`);
  if (mismatches.length) {
    throw new Error(
      `Version ${parsed.version} is not synchronized: ${mismatches.join(', ')}`,
    );
  }
  return parsed;
}

export function changelogContainsVersion(changelog, tag) {
  const heading = new RegExp(`^##\\s+${escapeRegExp(tag)}\\s+[—-]\\s+(\\d{4})-(\\d{2})-(\\d{2})\\s*$`);
  const lines = changelog.split(/\r?\n/);
  let fenced = false;
  for (let index = 0; index < lines.length; index++) {
    if (/^\s*```/.test(lines[index])) { fenced = !fenced; continue; }
    if (fenced) continue;
    const match = heading.exec(lines[index]);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) return false;
    let bodyFence = false;
    for (let body = index + 1; body < lines.length; body++) {
      if (/^\s*```/.test(lines[body])) { bodyFence = !bodyFence; continue; }
      if (!bodyFence && /^##\s+/.test(lines[body])) break;
      if (!bodyFence && /^-\s+\S/.test(lines[body])) return true;
    }
    return false;
  }
  return false;
}

export function validateReleaseNotes(notes, { tag, repo }) {
  const marker = `<!-- release: ${tag} -->`;
  if (notes.split(/\r?\n/, 1)[0] !== marker)
    throw new Error(`Release notes must start with the exact ${marker} marker`);
  if (/^##\s+(Русский|English)\s*$/m.test(notes))
    throw new Error('Legacy release-note headings are forbidden; use the canonical bilingual template');
  const mainIndex = notes.indexOf('## Основное');
  const highlightsIndex = notes.indexOf('## Highlights');
  if (mainIndex < 0 || highlightsIndex < 0 || highlightsIndex <= mainIndex)
    throw new Error('Release notes must contain canonical ## Основное then ## Highlights sections');
  if (notes.slice(marker.length, mainIndex).trim())
    throw new Error('Release notes cannot contain text or bullets before ## Основное');

  const main = notes.slice(mainIndex, highlightsIndex);
  const highlights = notes.slice(highlightsIndex);
  const mainBullets = [...main.matchAll(/^-\s+(.+)$/gm)].map((match) => match[1].trim());
  const highlightBullets = [...highlights.matchAll(/^-\s+(.+)$/gm)].map((match) => match[1].trim());
  if (!mainBullets.length || !highlightBullets.length)
    throw new Error('Both release-note language sections must contain at least one bullet');
  if (mainBullets.length !== highlightBullets.length || mainBullets.length > 4)
    throw new Error('Release notes must contain equivalent RU/EN lists with at most four bullets each');
  if (mainBullets.at(-1) !== 'Мелкие исправления и улучшения.')
    throw new Error('Russian release notes must end with the grouped small-fixes bullet');
  if (highlightBullets.at(-1) !== 'Small fixes and improvements.')
    throw new Error('English release notes must end with the grouped small-fixes bullet');

  const ruLink = `https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.ru.md`;
  const enLink = `https://github.com/${repo}/blob/${tag}/docs/CHANGELOG.md`;
  if (!notes.includes(ruLink) || !notes.includes(enLink))
    throw new Error(`Release notes must link both changelogs at the immutable ${tag} tag`);
  return notes.trim() + '\n';
}

export function readReleaseContract(root = process.cwd()) {
  const read = (name) => readFileSync(resolve(root, name), 'utf8');
  return {
    sources: parseVersionSources({
      packageJson: read('package.json'),
      packageLock: read('package-lock.json'),
      manifest: read('custom_components/houseplan/manifest.json'),
      constSource: read('custom_components/houseplan/const.py'),
      cardSource: read('src/houseplan-card.ts'),
    }),
    changelogRu: read('docs/CHANGELOG.ru.md'),
    changelogEn: read('docs/CHANGELOG.md'),
    notes: read('docs/RELEASE-NOTES.md'),
  };
}

export function assertReleaseContract({
  root = process.cwd(), tag, repo = 'Matysh/houseplan-card', requirePrerelease = true,
} = {}) {
  const contract = readReleaseContract(root);
  const parsed = validateVersionSources(tag, contract.sources, { requirePrerelease });
  if (!changelogContainsVersion(contract.changelogRu, tag))
    throw new Error(`docs/CHANGELOG.ru.md has no dated ${tag} section`);
  if (!changelogContainsVersion(contract.changelogEn, tag))
    throw new Error(`docs/CHANGELOG.md has no dated ${tag} section`);
  validateReleaseNotes(contract.notes, { tag, repo });
  return { ...parsed, tag, repo, sources: contract.sources };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const args = process.argv.slice(2);
    const positionals = args.filter((arg) => !arg.startsWith('--'));
    const repoArgs = args.filter((arg) => arg.startsWith('--repo='));
    const unknown = args.filter((arg) => arg.startsWith('--') && !arg.startsWith('--repo='));
    if (positionals.length !== 1) throw new Error('Exactly one release tag is required');
    if (repoArgs.length > 1 || unknown.length)
      throw new Error(`Unknown or duplicate release-contract arguments: ${[...repoArgs.slice(1), ...unknown].join(', ')}`);
    const tag = positionals[0];
    const repo = repoArgs[0]?.slice('--repo='.length)
      || process.env.GITHUB_REPOSITORY || 'Matysh/houseplan-card';
    const result = assertReleaseContract({ tag, repo, requirePrerelease: true });
    console.log(JSON.stringify({
      ok: true, tag: result.tag, version: result.version,
      prerelease: result.prerelease, sources: result.sources,
    }, null, 2));
  } catch (error) {
    console.error(`release contract failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
