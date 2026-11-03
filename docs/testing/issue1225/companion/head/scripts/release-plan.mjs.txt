// houseplan-card#796: resolve moving aliases once, before any HA is started.
// Job labels retain the requested target: houseplan-card's release gate uses
// journeys/first-run names to identify its exact tag/SHA dispatch.

import { compareTags, STABLE_TAG } from './tags.mjs';

const RELEASE_TRAILER = /^Release:[ \t]*(v\d+\.\d+\.\d+)[ \t]*$/gm;

export function requireVersion(actual, expected) {
  if (expected != null && expected !== '' && actual !== expected) {
    throw new Error(`Installed House Plan version ${actual} differs from planned ${expected}`);
  }
}

export async function planRun({ event = 'workflow_dispatch', targetRef = 'latest',
  upgradeFrom = 'stable', haVersion = 'stable' } = {}, ops) {
  let catalog;
  const releases = () => (catalog ??= ops.releases());
  const resolutions = new Map();
  const resolveRef = (ref) => {
    if (!resolutions.has(ref)) resolutions.set(ref, (async () => {
      if (ref === 'latest' || ref === 'stable') {
        const release = (await releases()).find((r) => !r.draft && (ref === 'latest' || !r.prerelease));
        if (!release?.tag_name) throw new Error(`No published ${ref} House Plan release`);
        return resolveRef(release.tag_name);
      }
      // Tags install the actual HACS ZIP; branches resolve to a commit tarball.
      const pinned = ref.startsWith('v') ? ref : await ops.commit(ref);
      if (!ref.startsWith('v') && !/^[a-f0-9]{40}$/i.test(pinned)) {
        throw new Error(`Invalid commit resolved for ${ref}`);
      }
      const version = await ops.version(pinned);
      if (typeof version !== 'string' || !version.trim()) throw new Error(`No manifest version for ${pinned}`);
      return { ref: pinned, version };
    })());
    return resolutions.get(ref);
  };

  const target = await resolveRef(targetRef);
  let source = await resolveRef(upgradeFrom);
  if (source.version === target.version) {
    if (upgradeFrom !== 'stable') {
      throw new Error(`Upgrade source ${source.ref} and target ${target.ref} both have version ${target.version}; choose a different upgrade_from`);
    }
    const stable = (await releases()).filter((r) => !r.draft && !r.prerelease);
    const current = stable.findIndex((r) => r.tag_name === source.ref);
    if (current < 0) throw new Error(`Stable source ${source.ref} is absent from the release catalog`);
    let previous;
    for (const release of stable.slice(current + 1)) {
      const candidate = await resolveRef(release.tag_name);
      if (candidate.version !== target.version) { previous = candidate; break; }
    }
    if (!previous) throw new Error(`No previous stable House Plan version distinct from ${target.version}; cannot test upgrade`);
    source = previous;
  }

  // houseplan-card#1010: a green stable gate leaves its evidence frames as the
  // new "last stable" baseline. The release workflow (#540) dispatches the
  // candidate by its exact SHA before the tag exists; the candidate declares
  // its own stable tag in a `Release: vX.Y.Z` trailer, which the gate already
  // requires to name exactly that tag, and its manifest carries that version.
  // A stable tag already pointing at the SHA (published release, repair)
  // counts too, and so does an explicit stable tag; moving aliases
  // (latest/stable) and schedules never do. Best effort: the baseline is
  // material to look at, so an API failure here leaves it unset instead of
  // failing the run.
  let stableTag = '';
  if (event === 'workflow_dispatch') {
    if (STABLE_TAG.test(targetRef)) stableTag = targetRef;
    else if (/^[a-f0-9]{40}$/i.test(target.ref)) stableTag = await candidateStableTag(target, ops);
  }

  const schedule = event === 'schedule';
  const has = schedule ? ['stable', 'beta'] : [haVersion];
  const suites = [
    { suite: 'journeys', variant: 'house', ref: targetRef, install_ref: target.ref, install_version: target.version,
      projects: '--project=admin --project=viewer --project=mobile' },
    { suite: 'first-run', variant: 'empty', ref: targetRef, install_ref: target.ref, install_version: target.version,
      projects: '--project=first-run-admin' },
    { suite: 'upgrade', variant: 'house', ref: source.ref, install_ref: source.ref, install_version: source.version,
      projects: '--project=upgrade' },
  ];
  const include = has.flatMap((ha) => suites.map((suite) => ({ ...suite, ha,
    target_ref: target.ref, target_version: target.version })));
  if (schedule) {
    const dev = await resolveRef('dev');
    include.push({ suite: 'journeys-dev', variant: 'house', ref: 'dev', install_ref: dev.ref,
      install_version: dev.version, target_ref: dev.ref, target_version: dev.version,
      ha: 'stable', projects: '--project=admin --project=viewer --project=mobile' });
  }
  return { matrix: { include }, upgrade: { source, target }, stableTag };
}

async function candidateStableTag(target, ops) {
  try {
    const declared = ops.message ? [...(await ops.message(target.ref)).matchAll(RELEASE_TRAILER)].map((m) => m[1]) : [];
    if (declared.length === 1 && declared[0] === `v${target.version}`) return declared[0];
    if (!ops.tags) return '';
    const tags = (await ops.tags()).filter((t) => STABLE_TAG.test(t.name) && t.commit?.sha === target.ref);
    return tags.map((t) => t.name).sort(compareTags).at(-1) ?? '';
  } catch (error) {
    console.warn(`stable baseline: candidate tag unknown (${error.message})`);
    return '';
  }
}

export function githubOps({ token = process.env.GITHUB_TOKEN, fetchImpl = fetch } = {}) {
  const base = 'https://api.github.com/repos/Matysh/houseplan-card';
  const headers = { 'User-Agent': 'houseplan-e2e', Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const json = async (path, accept = headers.Accept) => {
    const response = await fetchImpl(`${base}/${path}`, { headers: { ...headers, Accept: accept } });
    if (!response.ok) throw new Error(`House Plan API ${path}: HTTP ${response.status}`);
    return response.json();
  };
  return {
    releases: async () => {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const batch = await json(`releases?per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new Error('Invalid House Plan release catalog');
        all.push(...batch);
        if (batch.length < 100) return all;
      }
      throw new Error('House Plan release catalog exceeds 2000 entries; cannot choose a reliable upgrade source');
    },
    commit: async (ref) => (await json(`commits/${encodeURIComponent(ref)}`)).sha,
    message: async (sha) => (await json(`commits/${encodeURIComponent(sha)}`)).commit.message,
    tags: async () => {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const batch = await json(`tags?per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new Error('Invalid House Plan tag list');
        all.push(...batch);
        if (batch.length < 100) break;
      }
      return all;
    },
    version: async (ref) => (await json(
      `contents/custom_components/houseplan/manifest.json?ref=${encodeURIComponent(ref)}`,
      'application/vnd.github.raw+json')).version,
  };
}
