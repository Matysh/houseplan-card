import { membershipIssueNumbers } from './release-data.mjs';
import { isDeliveryObserved } from './release.mjs';

const done = record => ['completed', 'not-required'].includes(record?.status);
const reason = error => String(error?.message ?? error).slice(0, 1200);
const labelNames = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);

/** Finish delivery only. This function never publishes, builds or runs tests again. */
export async function completePublishedRelease({ candidate: input, api, git, verifyDelivery, returnToDev, announce,
  onUpdate, onProgress = () => {} }) {
  if (input?.status !== 'published') throw Error('Complete an actually published release');
  if (typeof onUpdate !== 'function') throw Error('Completion requires the existing durable release state');
  const candidate = structuredClone(input), pending = [];
  const included = membershipIssueNumbers(candidate.membership, candidate.sha);
  candidate.completion ??= {};
  const save = async (name, result) => {
    await onUpdate({ type: 'completion-step', candidate: candidate.id, name, result });
    candidate.completion[name] = structuredClone(result);
    onProgress({ phase: name, status: result.status, tag: candidate.tag });
  };
  const defer = async (name, error, extra = {}) => {
    const result = { ...extra, status: 'pending', reason: reason(error) };
    await save(name, result); pending.push({ step: name, reason: result.reason }); return result;
  };

  if (!candidate.delivery) {
    onProgress({ phase: 'hacs', status: 'running', tag: candidate.tag });
    if (!verifyDelivery) return { status: 'pending', pending: [{ step: 'hacs', reason: 'Release discovery verification is not configured' }], candidate };
    try {
      const observation = await verifyDelivery({ candidate, assetName: 'houseplan.zip', onProgress });
      const evidence = observation?.evidence ?? observation;
      if (evidence?.status === 'waiting' || evidence?.status === 'pending')
        return { status: 'pending', pending: [{ step: 'hacs', reason: evidence.reason ?? 'Release discovery has not exposed this release yet' }], candidate };
      if (!isDeliveryObserved(evidence) || evidence.tag !== candidate.tag || evidence.artifactDigest !== candidate.publication.artifactDigest)
        throw Error('Delivery observation does not identify the published ZIP');
      await onUpdate({ type: 'delivery-verified', candidate: candidate.id, evidence }); candidate.delivery = structuredClone(evidence);
    } catch (error) { return { status: 'pending', pending: [{ step: 'hacs', reason: reason(error) }], candidate }; }
  }

  if (!done(candidate.completion.issues)) {
    let work = candidate.completion.issues;
    try {
      if (!work?.eligible) {
        const issues = await Promise.all(included.map(number => api.getIssue(number)));
        const open = issues.filter(issue => issue.state !== 'closed');
        work = { status: 'running', eligible: open.filter(issue => labelNames(issue).includes('S8-merged')).map(issue => issue.number),
          waitingForS8: open.filter(issue => !labelNames(issue).includes('S8-merged')).map(issue => issue.number), completed: [] };
        // Save eligibility before removing S8, so a lost response can resume the same issue.
        await save('issues', work);
      } else if (work.waitingForS8?.length) {
        const waitingForS8 = [], eligible = new Set(work.eligible);
        for (const number of work.waitingForS8) {
          if (!included.includes(number)) throw Error('Stored closure work is outside the immutable release membership');
          const issue = await api.getIssue(number);
          if (issue.state === 'closed') continue;
          if (labelNames(issue).includes('S8-merged')) eligible.add(number);
          else waitingForS8.push(number);
        }
        work = { ...work, status: 'running', eligible: [...eligible], waitingForS8 };
        await save('issues', work);
      }
      const complete = new Set(work.completed ?? []), errors = [];
      for (const number of work.eligible) {
        if (complete.has(number)) continue;
        if (!included.includes(number)) throw Error('Stored closure work is outside the immutable release membership');
        try {
          const issue = await api.getIssue(number), comments = await api.listIssueComments(number);
          const marker = `<!-- houseplan-release:${candidate.tag} -->`;
          if (!comments.some(comment => String(comment.body ?? comment).includes(marker))) {
            const host = api.webBase ?? 'https://github.com';
            const repository = `${api.owner}/${api.repo}`, tag = encodeURIComponent(candidate.tag);
            const releaseUrl = `${host}/${repository}/releases/tag/${tag}`;
            const docs = `${host}/${repository}/blob/${tag}/docs/`;
            await api.comment(number, `Выпущено в \`${candidate.tag}\` · [релиз](${releaseUrl})\n\n[Changelog RU](${docs}CHANGELOG.ru.md) · [Changelog EN](${docs}CHANGELOG.md)\n\n${marker}`);
          }
          for (const label of labelNames(issue).filter(name => /^S\d+-/.test(name))) await api.removeLabel(number, label);
          if (issue.state !== 'closed') await api.updateIssue(number, { state: 'closed', state_reason: 'completed' });
          complete.add(number);
          work = { status: 'running', eligible: work.eligible, waitingForS8: work.waitingForS8 ?? [], completed: [...complete] };
          await save('issues', work);
        } catch (error) { errors.push({ issue: number, reason: reason(error) }); }
      }
      const waitingForS8 = work.waitingForS8 ?? [];
      work = { status: errors.length || waitingForS8.length ? 'pending' : 'completed', eligible: work.eligible,
        waitingForS8, completed: [...complete], ...(errors.length ? { errors } : {}) };
      await save('issues', work);
      if (errors.length || waitingForS8.length) pending.push({ step: 'issues', reason: [
        ...errors.map(error => `#${error.issue}: ${error.reason}`),
        ...(waitingForS8.length ? [`Waiting for S8 bookkeeping: ${waitingForS8.map(number => `#${number}`).join(', ')}`] : []),
      ].join('; ') });
    } catch (error) { await defer('issues', error, work ?? {}); }
  }

  // User delivery is complete before an internal return can wait on the task queue.
  if (candidate.kind !== 'beta') {
    try {
      if (!announce) throw Error('Stable Telegram announcement is not configured');
      const result = await announce({ candidate, persist: async receipt => {
        await onUpdate({ type: 'announcement', candidate: candidate.id, receipt }); candidate.announcement = structuredClone(receipt);
      }, onProgress });
      if (!['sent', 'completed', 'not-required'].includes(result?.status)) pending.push({ step: 'announcement', reason: result?.reason ?? 'Stable announcement has not completed' });
    } catch (error) { pending.push({ step: 'announcement', reason: reason(error) }); }
  }
  if (!done(candidate.completion['retire-beta'])) {
    const previous = candidate.retiredBeta;
    if (candidate.kind !== 'beta' || !previous) await save('retire-beta', { status: 'not-required' });
    else {
      try {
        if (!previous.branch?.startsWith('release/') || previous.branch === candidate.branch || !/^[a-f0-9]{40}$/.test(previous.sha ?? ''))
          throw Error('Previous beta branch identity is incomplete or protected');
        if (!git) throw Error('Beta branch cleanup is not configured');
        const current = await git.remoteHead(previous.branch);
        if (current && current !== previous.sha) throw Error('Previous beta branch advanced; it was preserved');
        if (current && !await git.deleteBranchIfUnchanged(previous.branch, previous.sha)) {
          if (await git.remoteHead(previous.branch)) throw Error('Previous beta branch changed while deleting; it was preserved');
        }
        await save('retire-beta', { status: 'completed', branch: previous.branch, sha: previous.sha });
      } catch (error) { await defer('retire-beta', error); }
    }
  }

  if (!done(candidate.completion['return-to-dev'])) {
    if (candidate.kind === 'beta' && !(candidate.portToDev ?? []).length) await save('return-to-dev', { status: 'not-required' });
    else {
      try {
        if (!returnToDev) throw Error('Return of published history to dev is not configured');
        const result = await returnToDev({ candidate, previous: candidate.completion['return-to-dev'], onProgress });
        if (result?.status === 'completed' || result?.alreadyIncluded || result?.devSha)
          await save('return-to-dev', { ...result, status: 'completed' });
        else await defer('return-to-dev', result?.reason ?? 'Published history is queued but has not reached dev', result ?? {});
      } catch (error) { await defer('return-to-dev', error, candidate.completion['return-to-dev'] ?? {}); }
    }
  }

  return { status: pending.length ? 'pending' : 'completed', pending, candidate };
}
