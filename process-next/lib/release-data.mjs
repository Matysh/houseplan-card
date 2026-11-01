/** Small readers for existing release facts. Missing bookkeeping never rejects a task merge. */
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const categories = new Set(['major', 'stable-fix', 'infra', 'line-fix']);

export async function readTaskReleaseMilestone({ git, materialSha, issue, fallbackSha }) {
  if (!sha(materialSha) || !Number.isSafeInteger(issue) || issue < 1)
    return { status: 'pending', issue, reason: 'Release bookkeeping needs the actual task commit and issue' };
  try {
    const cycle = JSON.parse(await git.git(['show', `${materialSha}:docs/release-ledger/cycle.json`]));
    if (!/^v\d+\.\d+\.\d+$/.test(cycle.baseStable ?? '') || !Number.isSafeInteger(cycle.milestone?.number) || cycle.milestone.number < 1)
      throw Error('Release cycle has no explicit base and milestone');
    const readEntry = async commit => {
      const entry = JSON.parse(await git.git(['show', `${commit}:docs/release-ledger/${cycle.baseStable}/${issue}.json`]));
      if (entry.issue !== issue || entry.baseStable !== cycle.baseStable || !categories.has(entry.category))
        throw Error('Release classification does not describe this issue and cycle');
      return entry;
    };
    let entry;
    try { entry = await readEntry(materialSha); }
    catch (error) {
      if (!sha(fallbackSha) || fallbackSha === materialSha) throw error;
      // Repair a missing record later without merging the task again. Its original
      // cycle is immutable: a newer cycle in dev cannot reassign an old task.
      entry = await readEntry(fallbackSha);
    }
    return { status: 'ready', issue, category: entry.category, cycle,
      cycleMilestone: cycle.milestone.number,
      milestone: ['major', 'stable-fix'].includes(entry.category) ? cycle.milestone.number : null };
  } catch (error) {
    return { status: 'pending', issue, reason: `Release bookkeeping is not available: ${error.message}` };
  }
}

/** Membership is derived from the immutable candidate history, never from a live S8 query. */
export async function buildCandidateMembership({ git, candidateSha, baseSha = null, tag, tasks = [], previousMembership }) {
  if (!sha(candidateSha) || baseSha !== null && !sha(baseSha)) throw Error('Membership needs exact candidate/base commits');
  if (baseSha) await git.git(['merge-base', '--is-ancestor', baseSha, candidateSha]);
  const range = baseSha ? `${baseSha}..${candidateSha}` : candidateSha;
  const history = await git.git(['log', '--topo-order', '--format=%H%x00%B%x00%x1e', range]);
  const found = new Map(), rangeCommits = new Set();
  for (const raw of history.split('\x1e')) {
    const [commit, message = ''] = raw.trim().split('\0');
    if (!commit) continue;
    if (!sha(commit)) throw Error('Invalid Git membership record');
    rangeCommits.add(commit);
    if (/^Release:\s*\S/m.test(message) || /^Delivery-Phase:\s*spec-review\/v1\s*$/m.test(message)) continue;
    const issues = [...message.matchAll(/^Issue:\s*#([1-9]\d*)\s*$/gm)].map(match => Number(match[1]));
    if (!issues.length) continue;
    // Historical spec publishers predate the explicit phase trailer. A spec report
    // plus its index is not an implementation delivery; ordinary docs tasks still are.
    const paths = (await git.git(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', commit])).trim().split('\n').filter(Boolean);
    if (paths.length && paths.some(path => /^docs\/reviews\/SPEC-REVIEW[^/]*\.md$/i.test(path))
      && paths.every(path => /^docs\/reviews\/SPEC-REVIEW[^/]*\.md$/i.test(path) || path === 'docs/reviews/INDEX.md')) continue;
    for (const issue of issues) {
      const commits = found.get(issue) ?? new Set(); commits.add(commit); found.set(issue, commits);
    }
  }
  // Recent queue records also name real merges when an author's commit had no trailer.
  // A live label alone is never membership; both range boundaries are checked in Git.
  for (const task of tasks) {
    if (task.releaseTag || task.status !== 'S8-merged' || !sha(task.mergedSha) || !Number.isSafeInteger(task.issue) || task.issue < 1) continue;
    if (!rangeCommits.has(task.mergedSha)) continue;
    const commits = found.get(task.issue) ?? new Set(); commits.add(task.mergedSha); found.set(task.issue, commits);
  }
  // The candidate may outlive the queue's retained completed entries. Preserve its
  // already-recorded facts only while their commits remain in this exact Git range.
  for (const row of previousMembership?.issues ?? []) {
    if (!Number.isSafeInteger(row.number) || row.number < 1) continue;
    const present = (row.commits ?? []).filter(commit => rangeCommits.has(commit));
    if (!present.length) continue;
    const commits = found.get(row.number) ?? new Set(); present.forEach(commit => commits.add(commit)); found.set(row.number, commits);
  }
  return { schema: 1, tag: tag ?? null, candidate: candidateSha, base: baseSha,
    issues: [...found].sort(([a], [b]) => a - b).map(([number, commits]) => ({ number, commits: [...commits].sort() })) };
}

export function membershipIssueNumbers(membership, candidateSha) {
  if (!membership || membership.schema !== 1 || membership.candidate !== candidateSha
    || !Array.isArray(membership.issues) || membership.issues.some(row => !Number.isSafeInteger(row.number) || row.number < 1
      || !Array.isArray(row.commits) || !row.commits.length || row.commits.some(commit => !sha(commit))))
    throw Error('Release membership must name this immutable candidate and its issue commits');
  return [...new Set(membership.issues.map(row => row.number))].sort((a, b) => a - b);
}
