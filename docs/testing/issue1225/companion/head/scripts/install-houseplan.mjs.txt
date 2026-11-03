#!/usr/bin/env node
/**
 * Put the integration under test into the run directory, the way users get it.
 *
 *   node scripts/install-houseplan.mjs --ref=latest   newest GitHub release, prereleases included (HACS beta channel)
 *   node scripts/install-houseplan.mjs --ref=stable   newest non-prerelease
 *   node scripts/install-houseplan.mjs --ref=v1.73.0-beta.6
 *   node scripts/install-houseplan.mjs --ref=dev      branch or commit snapshot, frontend built from that commit
 *   node scripts/install-houseplan.mjs --ref=/path/to/houseplan-card   local checkout, as it is on disk
 *
 * Releases are installed from the `houseplan.zip` asset — the exact bytes HACS
 * downloads — so the frontend bundle, its assets and the version pin are the
 * shipped ones, not a rebuild.
 *
 * A branch or commit is installed from its source tree. Since houseplan-card
 * #657/#1016 the committed bundle changes only in a release-candidate commit;
 * on any other commit it legally lags behind the sources (on `dev` it is the
 * previous release's frontend under the new backend). So the frontend is
 * built from the same commit (`npm ci`, `npm run build`, `bundle-sync
 * --release`). When the build reproduces the committed bundle byte for byte —
 * a release candidate, which the stable gate dispatches by SHA — the committed
 * bytes are the ones installed; otherwise the fresh build is, and the run
 * record says so (houseplan-card#1010).
 *
 * The product's declared test contract of the same ref goes to
 * `<out>/.e2e-contract.json`: the journeys gate themselves on what the
 * installed product declares (tests/lib/contract.mjs), not on its version
 * string — a `dev` snapshot carries the previous release's version.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireVersion } from './release-plan.mjs';
import { sameTree, treeDigest } from './tree-digest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'Matysh/houseplan-card';
const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const ref = arg('ref', process.env.HOUSEPLAN_REF || 'latest');
const out = resolve(ROOT, arg('out', 'run'));
const target = join(out, 'custom_components', 'houseplan');
const headers = { 'User-Agent': 'houseplan-e2e', Accept: 'application/vnd.github+json' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

const fetchJson = async (url) => {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};
const download = async (url, file) => {
  const r = await fetch(url, { headers: { 'User-Agent': 'houseplan-e2e' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  writeFileSync(file, Buffer.from(await r.arrayBuffer()));
};

async function resolveRelease() {
  if (ref === 'latest' || ref === 'stable') {
    const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=20`);
    const pick = releases.find((r) => !r.draft && (ref === 'latest' || !r.prerelease));
    if (!pick) throw new Error(`no ${ref} release found`);
    return pick;
  }
  return fetchJson(`https://api.github.com/repos/${REPO}/releases/tags/${ref}`);
}

/** Build the frontend of a source tree into its integration folder. */
function buildFrontend(src) {
  const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['bundle:release']) return 'committed (no bundle:release script in this ref)';
  const frontend = join(src, 'custom_components', 'houseplan', 'frontend');
  const committed = treeDigest(frontend);
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: src, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: '1' } });
  console.log(`building the frontend of ${ref} from source…`);
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npm', ['run', 'build']);
  const keep = join(src, '.committed-frontend');
  cpSync(frontend, keep, { recursive: true });
  run('node', ['scripts/bundle-sync.mjs', '--release']);
  if (sameTree(committed, treeDigest(frontend))) {
    rmSync(frontend, { recursive: true, force: true });
    cpSync(keep, frontend, { recursive: true });
    return 'committed (the build reproduces it byte for byte)';
  }
  return 'built from source (the committed bundle lags behind this commit)';
}

rmSync(target, { recursive: true, force: true });
const work = mkdtempSync(join(tmpdir(), 'hp-e2e-'));
let installed;
let bundle = 'release asset';
let contract = null;
if (existsSync(ref) && existsSync(join(ref, 'custom_components', 'houseplan'))) {
  cpSync(join(ref, 'custom_components', 'houseplan'), target, { recursive: true });
  installed = `local ${ref}`;
  bundle = 'as on disk';
  const file = join(ref, 'docs', 'data-hp-contract.json');
  if (existsSync(file)) contract = readFileSync(file, 'utf8');
} else if (/^[A-Za-z0-9_.\/-]+$/.test(ref) && !ref.startsWith('v') && ref !== 'latest' && ref !== 'stable') {
  // a branch or commit: its source tree from codeload, frontend built from it
  const tgz = join(work, 'src.tgz');
  await download(`https://codeload.github.com/${REPO}/tar.gz/${ref}`, tgz);
  execFileSync('tar', ['-xzf', tgz, '-C', work]);
  const src = execFileSync('sh', ['-c', `ls -d ${work}/*/ | head -n 1`]).toString().trim();
  bundle = buildFrontend(src);
  cpSync(join(src, 'custom_components', 'houseplan'), target, { recursive: true });
  installed = `branch ${ref}`;
  const file = join(src, 'docs', 'data-hp-contract.json');
  if (existsSync(file)) contract = readFileSync(file, 'utf8');
} else {
  const release = await resolveRelease();
  const asset = release.assets.find((a) => a.name === 'houseplan.zip');
  if (!asset) throw new Error(`${release.tag_name}: no houseplan.zip asset`);
  const zip = join(work, 'houseplan.zip');
  await download(asset.browser_download_url, zip);
  execFileSync('unzip', ['-q', zip, '-d', join(work, 'zip')]);
  // the zip is the integration folder itself (manifest.json at the top level)
  const root = existsSync(join(work, 'zip', 'manifest.json'))
    ? join(work, 'zip') : join(work, 'zip', 'custom_components', 'houseplan');
  cpSync(root, target, { recursive: true });
  installed = `release ${release.tag_name}${release.prerelease ? ' (prerelease)' : ''}`;
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${release.tag_name}/docs/data-hp-contract.json`);
  // only a release older than the contract (#489) has none; any other answer
  // (rate limit, outage) must not turn into "declares nothing, skip it all"
  if (r.ok) contract = await r.text();
  else if (r.status !== 404) throw new Error(`${release.tag_name}: data-hp contract HTTP ${r.status}`);
}
rmSync(work, { recursive: true, force: true });
const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'));
requireVersion(manifest.version, arg('expect-version'));
// the installed product's own test contract; a ref older than the contract
// (#489) declares nothing, and every gated journey says so
writeFileSync(join(out, '.e2e-contract.json'), contract ?? '{"schemaVersion":1,"hooks":{}}\n');
writeFileSync(join(out, '.e2e-houseplan.json'), JSON.stringify({ ref, installed, bundle, version: manifest.version }, null, 2));
console.log(`houseplan ${manifest.version} ← ${installed} · frontend: ${bundle} → ${target}`);
