const version = value => /^v?\d+\.\d+\.\d+$/.test(value ?? '')
  ? value.replace(/^v/, '').split('.').map(Number) : null;
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
export const cyclePath = 'docs/release-ledger/cycle.json';

export async function readReleaseCycle(git, commit) {
  await git.ensureCommit?.(commit);
  return JSON.parse(await git.git(['show', `${commit}:${cyclePath}`]));
}

/** Stable completion carries this metadata through the existing return task.
 * Never rewind a newer dev cycle or manufacture a future release version. */
export async function planStableCycle({ candidate, api, git }) {
  if (candidate.kind !== 'stable') return null;
  const published = version(candidate.tag);
  if (!published) throw Error('Stable cycle requires a full release version');
  const dev = await git.remoteHead(git.dev ?? 'dev');
  const current = await readReleaseCycle(git, dev), base = version(current.baseStable);
  if (!base) throw Error('Current release cycle has no valid stable base');
  if (compare(base, published) >= 0) return null;
  const upcoming = (await api.listOpenMilestones())
    .filter(row => row.state === 'open' && Number.isSafeInteger(row.number) && row.number > 0
      && version(row.title) && compare(version(row.title), published) > 0)
    .sort((a, b) => compare(version(a.title), version(b.title)) || a.number - b.number);
  // Preserve an explicitly planned future target if it is still open.
  const next = upcoming.find(row => row.number === current.milestone?.number) ?? upcoming[0];
  return { schema: 1, baseStable: candidate.tag,
    targetStable: next ? 'v' + next.title.replace(/^v/, '') : null,
    milestone: next ? { number: next.number, title: next.title } : null };
}

export async function verifyReleaseCycle(git, commit, expected) {
  if (!expected) return;
  const actual = await readReleaseCycle(git, commit);
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw Error('Release history returned without the prepared next release cycle');
}
