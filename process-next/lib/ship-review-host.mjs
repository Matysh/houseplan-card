import { randomUUID } from 'node:crypto';
import { buildShipReviewPacket } from './ship-review.mjs';

const ready = result => ['accepted', 'not-required'].includes(result?.verdict);
const records = state => Object.entries(state.shipReviews ?? {}).map(([requestId, record]) => ({ ...record, requestId }));

/** One beta checkpoint. No test runner, individual task review or automatic paid retry. */
export async function ensureShipReview({ candidate, store, dispatch, queue, git, api, review, config,
  dependencies = {}, signal, onProgress = () => {}, pollMs = 15000, maxWaitMs = 45 * 60000 }) {
  let state = (await store.read()).state;
  const current = state.shipReviews?.[candidate.shipReview?.requestId];
  if (candidate.shipReview?.sha === candidate.sha && ready(current?.result)) return state;
  if (candidate.shipReview?.sha === candidate.sha && current?.result?.verdict === 'changes_requested')
    throw Error(`Пакетное ревью ship ${candidate.tag ?? candidate.id}: нужны исправления. ${current.result.reportUrl ?? ''}`.trim());
  // An incomplete review keeps its original packet and request identity. A failed
  // job can be rerun in Actions; invoking publication again never pays for a new request.
  const packet = candidate.shipReview?.sha === candidate.sha && current ? current.packet
    : await (dependencies.buildShipReviewPacket ?? buildShipReviewPacket)({ candidate, git, api,
      tasks: Object.values((await queue.store.read()).state.tasks), reviews: records(state) });
  state = await dispatch({ id: `ship-review:prepare:${randomUUID()}`, type: 'ship-review-prepared', candidate: candidate.id, packet });
  const save = async result => {
    state = await dispatch({ id: `ship-review:result:${randomUUID()}`, type: 'ship-review-result', candidate: candidate.id,
      requestId: packet.requestId, result });
    if (!ready(result)) throw Error(`Пакетное ревью ship ${packet.version}: ${result.verdict === 'changes_requested'
      ? 'нужны исправления' : 'не завершено; повторите неуспешную job по ссылке, затем эту команду'}. ${result.reportUrl ?? ''}`.trim());
    return state;
  };
  const identity = { kind: 'ship-batch', requestId: packet.requestId, candidateId: packet.candidateId,
    materialSha: packet.head, base: packet.base, selectionDigest: packet.selectionDigest };
  if (!packet.pending.length) return save({ ...identity, verdict: 'not-required', createdAt: new Date().toISOString(),
    markdown: `Пакетное ревью ship перед ${packet.version}: новых непросмотренных изменений нет.\n\n`
      + `Задач ship в кандидате: ${packet.tasks.length}; засчитано прежних принятых результатов: ${packet.reused.length}.` });
  const clock = dependencies.clock ?? Date.now, started = clock();
  const sleep = dependencies.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let knownRun = current?.result?.runId ? { id: current.result.runId } : null, dispatched = false, dispatchFailure = null;
  const escaped = packet.requestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const titleMatches = run => new RegExp(`(?:^|[^A-Za-z0-9:-])${escaped}(?:$|[^A-Za-z0-9:-])`).test(run.display_title ?? run.name ?? '');
  const matching = runs => runs.filter(titleMatches).sort((a, b) => Number(b.id) - Number(a.id));
  const readResult = async runs => {
    let incomplete = null;
    for (const run of runs) {
      if (run.status !== 'completed') continue;
      const result = await review.artifactResult(run);
      if (!result) continue;
      if (Object.entries(identity).some(([key, value]) => result[key] !== value)
        || result.verdict === 'incomplete' && result.workflowRunAttempt && result.workflowRunAttempt !== (run.run_attempt ?? 1))
        throw Error('Batch review report belongs to different material or workflow attempt');
      if (result.verdict !== 'incomplete') return result;
      incomplete ??= result;
    }
    return incomplete;
  };
  while (!signal?.aborted && clock() - started < maxWaitMs) {
    const runs = knownRun ? [await api.request('GET', `${api.root}/actions/runs/${knownRun.id}`)] : await review.runs();
    if (knownRun && !titleMatches(runs[0])) throw Error('Saved batch workflow run belongs to another request');
    let matches = matching(runs), result = await readResult(matches);
    // A duplicate job can reuse another run's artifact and upload nothing itself.
    // Before calling a finished known run incomplete, inspect its siblings once.
    if (knownRun && matches[0]?.status === 'completed' && (!result || result.verdict === 'incomplete')) {
      matches = matching([...new Map([...runs, ...await review.runs()].map(item => [item.id, item])).values()]);
      result = await readResult(matches) ?? result;
    }
    if (result && result.verdict !== 'incomplete') return save(result);
    const run = matches.find(item => item.status !== 'completed') ?? matches[0];
    if (run) {
      knownRun = run;
      onProgress({ kind: 'review', name: `Пакетное код-ревью ship перед ${packet.version}`, status: run.status,
        issues: packet.pending, elapsedMs: clock() - started, reportUrl: run.html_url });
      if (run.status === 'completed') {
        return save(result ?? { ...identity, verdict: 'incomplete', runId: run.id,
          runAttempt: run.run_attempt ?? 1, reportUrl: run.html_url,
          markdown: 'Workflow завершился без отчёта модели. Это технический сбой, а не принятие изменений.' });
      }
    } else if (!dispatched) {
      dispatched = true;
      onProgress({ kind: 'review', name: `Пакетное код-ревью ship перед ${packet.version}`, status: 'dispatching', issues: packet.pending });
      try {
        await api.request('POST', `${api.root}/actions/workflows/${encodeURIComponent(review.workflow)}/dispatches`, {
          ref: review.ref, inputs: { kind: 'ship-batch', issue: '', track: 'ship', base: packet.base ?? '', head: packet.head,
            requestId: packet.requestId, patchId: '', receipts: '[]', batch: JSON.stringify({ candidateId: packet.candidateId,
              version: packet.version, selectionDigest: packet.selectionDigest,
              stateBranch: config.release?.branch ?? 'process-release-state', statePath: config.release?.path ?? 'releases.json' }) } });
      } catch (error) { dispatchFailure = error; } // Observe a possibly delivered POST instead of dispatching twice.
    } else if (dispatchFailure && clock() - started >= 60000) {
      throw Error(`Не удалось подтвердить запуск пакетного ревью: ${dispatchFailure.message}. Проверьте Actions перед повтором команды.`);
    }
    await sleep(pollMs, signal);
  }
  throw Error(`Пакетное ревью ship ${packet.version}: ${signal?.aborted ? 'ожидание прервано' : 'ожидание истекло'}. `
    + `Повторите эту команду для получения того же результата${knownRun?.html_url ? ': ' + knownRun.html_url : '.'}`);
}
