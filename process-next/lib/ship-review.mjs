import { createHash } from 'node:crypto';
import { membershipIssueNumbers } from './release-data.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tracks = new Set(['ship', 'show', 'ask']);
const commitsOf = row => [...new Set(row.commits)].sort();

async function implementationRows({ git, range, membership, tasks }) {
  const history = new Map(), rows = new Map(), owners = new Map();
  const add = (issue, commit) => {
    if (!Number.isSafeInteger(issue) || issue < 1) return;
    if (!rows.has(issue)) rows.set(issue, new Set()); rows.get(issue).add(commit);
    if (!owners.has(commit)) owners.set(commit, new Set()); owners.get(commit).add(issue);
  };
  // One history read recovers legacy subject attribution and all first-parent
  // boundaries; it does not require repairing old commit messages or issue labels.
  const log = await git.git(['log', '--format=%x1e%H%x00%P%x00%B%x00', '--name-only', range]);
  for (const raw of log.split('\x1e').filter(value => value.trim())) {
    const [commit, parents, message = '', paths = ''] = raw.trim().split('\0');
    if (!sha(commit) || parents.split(' ').filter(Boolean).some(parent => !sha(parent))) throw Error('Invalid ship implementation history');
    const files = paths.trim().split('\n').filter(Boolean);
    const excluded = /^Release:\s*\S/m.test(message) || /^Delivery-Phase:\s*spec-review\/v1\s*$/m.test(message)
      || files.some(path => /^docs\/reviews\/SPEC-REVIEW[^/]*\.md$/i.test(path))
        && files.every(path => /^docs\/reviews\/SPEC-REVIEW[^/]*\.md$/i.test(path) || path === 'docs/reviews/INDEX.md');
    history.set(commit, { parent: parents.split(' ')[0] || null, excluded });
    if (excluded) continue;
    const attributed = [...message.matchAll(/^Issue:\s*#([1-9]\d*)\s*$/gm),
      ...message.split('\n')[0].matchAll(/\(#([1-9]\d*)\)/g)];
    for (const match of attributed) add(Number(match[1]), commit);
  }
  for (const row of membership.issues) for (const commit of row.commits) {
    if (!history.has(commit)) throw Error(`Ship review membership for #${row.number} contains a commit outside the candidate range`);
    if (!history.get(commit).excluded) add(row.number, commit);
  }
  const merged = tasks.filter(task => task.status === 'S8-merged' && history.has(task.mergedSha));
  for (const task of merged) {
    if (task.releaseTag) history.get(task.mergedSha).excluded = true;
    else if (!history.get(task.mergedSha).excluded) add(task.issue, task.mergedSha);
  }
  const exact = new Map();
  for (const task of merged.filter(task => !task.releaseTag && task.expectedBase != null)) {
    if (!sha(task.expectedBase)) throw Error('Merged task needs an exact implementation base');
    await git.git(['merge-base', '--is-ancestor', task.expectedBase, task.mergedSha]);
    const commits = (await git.git(['rev-list', `${task.expectedBase}..${task.mergedSha}`])).split(/\s+/)
      .filter(commit => history.has(commit) && !history.get(commit).excluded);
    if (!exact.has(task.issue)) exact.set(task.issue, new Set());
    for (const commit of commits) { add(task.issue, commit); exact.get(task.issue).add(commit); }
  }
  for (const [issue, commits] of rows) for (const tip of [...commits]) {
    if (exact.get(issue)?.has(tip)) continue;
    // Older fast-forward deliveries only recorded their tip. Include contiguous
    // unattributed work before it, stopping at another task, service commit or stable.
    for (let commit = tip; history.has(commit); commit = history.get(commit).parent) {
      const attributed = owners.get(commit);
      if (history.get(commit).excluded || attributed?.size && !attributed.has(issue)) break;
      commits.add(commit);
    }
  }
  return [...rows].sort(([a], [b]) => a - b).map(([number, commits]) => ({ number,
    commits: [...commits].filter(commit => !history.get(commit).excluded).sort() })).filter(row => row.commits.length);
}

/** Select from the pinned release membership, never from today's open/S8 issue list. */
export async function buildShipReviewPacket({ candidate, git, api, tasks = [], reviews = [] }) {
  const membership = candidate?.membership;
  const membershipIssues = membershipIssueNumbers(membership, candidate?.sha);
  if (!candidate.id || !sha(candidate.sha) || membership.base !== null && !sha(membership.base)
    || membershipIssues.length !== membership.issues.length)
    throw Error('Ship review needs an exact candidate, base and unambiguous release membership');
  if (membership.base) await git.git(['merge-base', '--is-ancestor', membership.base, candidate.sha]);
  const range = membership.base ? `${membership.base}..${candidate.sha}` : candidate.sha;
  const rows = await implementationRows({ git, range, membership, tasks });

  const selected = [], unclassified = [];
  for (const row of rows) {
    const issue = row.number, commits = commitsOf(row);
    const included = new Set(commits);
    // A later queue entry for the same issue must not rewrite this candidate's history.
    const merged = tasks.filter(task => task.issue === issue && task.status === 'S8-merged'
      && !task.releaseTag && included.has(task.mergedSha));
    const mergedTracks = [...new Set(merged.map(task => task.track).filter(track => tracks.has(track)))];
    let track = mergedTracks.includes('ship') ? 'ship' : mergedTracks[0], detail;
    if (!track) {
      // Completed queue entries can be pruned. An earlier packet freezes the ship
      // track, but only for implementation commits still present in this issue.
      const frozen = reviews.flatMap(review => review.packet?.tasks ?? []).find(task => task.issue === issue
        && task.track === 'ship' && Array.isArray(task.commits) && task.commits.length
        && task.commits.every(commit => included.has(commit)));
      if (frozen) track = 'ship';
      else {
        detail = await api.getIssue(issue);
        const labels = (detail.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
        const observed = [...new Set(labels.filter(label => /^track:(ship|show|ask)$/.test(label)))];
        // Legacy issue trailers need no metadata repair. Evidence of ship is
        // enough to include it even among conflicting labels; labels stay untouched.
        track = observed.includes('track:ship') ? 'ship' : observed[0]?.slice('track:'.length);
      }
    }
    if (!track) unclassified.push(issue);
    if (track !== 'ship') continue;
    detail ??= await api.getIssue(issue);
    selected.push({ issue, title: detail.title, url: detail.html_url ?? detail.url, body: detail.body ?? '',
      commits, fingerprint: hash(commits), track: 'ship' });
  }

  const pending = [], reused = [];
  for (const task of selected) {
    const accepted = reviews.find(review => review.result?.verdict === 'accepted'
      && typeof review.requestId === 'string' && review.requestId
      && review.packet?.pending?.includes(task.issue)
      && review.packet.tasks?.some(previous => previous.issue === task.issue
        && previous.track === 'ship' && previous.fingerprint === task.fingerprint
        && Array.isArray(previous.commits) && hash(commitsOf(previous)) === task.fingerprint));
    if (accepted) reused.push({ issue: task.issue, fingerprint: task.fingerprint,
      requestId: accepted.requestId, reportUrl: accepted.result.reportUrl ?? null });
    else pending.push(task.issue);
  }
  const selection = selected.map(({ issue, fingerprint }) => ({ issue, fingerprint }));
  const selectionDigest = hash(selection);
  const pendingDigest = hash(selection.filter(task => pending.includes(task.issue)));
  return { schema: 1, candidateId: candidate.id, base: membership.base, head: candidate.sha,
    version: candidate.tag || candidate.id, selectionDigest,
    requestId: `ship-review:${hash({ candidateId: candidate.id, base: membership.base, head: candidate.sha, pendingDigest })}`,
    tasks: selected, pending, reused, unclassified };
}
