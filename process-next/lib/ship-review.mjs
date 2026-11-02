import { createHash } from 'node:crypto';
import { membershipIssueNumbers } from './release-data.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const tracks = new Set(['ship', 'show', 'ask']);
const commitsOf = row => [...new Set(row.commits)].sort();

/** Select from the pinned release membership, never from today's open/S8 issue list. */
export async function buildShipReviewPacket({ candidate, git, api, tasks = [], reviews = [] }) {
  const membership = candidate?.membership;
  const issues = membershipIssueNumbers(membership, candidate?.sha);
  if (!candidate.id || !sha(candidate.sha) || membership.base !== null && !sha(membership.base)
    || issues.length !== membership.issues.length)
    throw Error('Ship review needs an exact candidate, base and unambiguous release membership');
  if (membership.base) await git.git(['merge-base', '--is-ancestor', membership.base, candidate.sha]);
  const range = membership.base ? `${membership.base}..${candidate.sha}` : candidate.sha;
  const reachable = new Set((await git.git(['rev-list', range])).split(/\s+/).filter(Boolean));
  for (const row of membership.issues) {
    if (row.commits.some(commit => !reachable.has(commit)))
      throw Error(`Ship review membership for #${row.number} contains a commit outside the candidate range`);
  }

  const selected = [], unclassified = [];
  for (const issue of issues) {
    const row = membership.issues.find(item => item.number === issue), commits = commitsOf(row);
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
