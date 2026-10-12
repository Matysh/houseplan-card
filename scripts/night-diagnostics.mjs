// Evidence classification cannot repair a gate or establish issue guilt.
import { intentionalDrift } from './candidate-readiness.mjs';
export function diagnoseNight({ run, jobs = [], evidence = null, sceneIds }) {
  const failed = jobs.filter(j => ['failure', 'timed_out', 'cancelled'].includes(j.conclusion));
  const locations = failed.map(job => ({ job: job.name, url: job.html_url || run.html_url,
    steps: (job.steps || []).filter(s => ['failure', 'timed_out', 'cancelled'].includes(s.conclusion))
      .map(s => ({ name: s.name, number: s.number, conclusion: s.conclusion,
        url: job.html_url ? `${job.html_url}#step:${s.number}:1` : run.html_url })) }));
  let category = 'unknown', reason = 'Причина не установлена; известны только упавшие gate/step. Задачи диапазона — кандидаты, не виновники.';
  // Structured evidence must be complete and bind THIS run attempt, not an
  // arbitrary nearby success, a timeout or the nightly dispatch parent.
  const valid = evidence?.complete === true && evidence.run === run.id && evidence.attempt === run.run_attempt
    && evidence.sha === run.head_sha && !!evidence.environmentKey && run.status === 'completed' && run.conclusion === 'failure';
  if (valid) {
    if (evidence.kind === 'product-assertion' && evidence.oracle && evidence.observedFailure) {
      category = 'product-regression'; reason = `Проверяемый продуктовый контракт: ${evidence.oracle}. ${evidence.observedFailure}`;
    } else if (evidence.kind === 'golden' && evidence.reviewed === true
      && intentionalDrift(evidence.results, evidence.scenes, sceneIds)) {
      category = 'intentional-drift'; reason = 'Разошлись только owner-reviewed intentional scenes. Это не PASS и не разрешение менять эталоны.';
    } else if (['environment', 'harness'].includes(evidence.kind) && evidence.observedFailure) {
      category = evidence.kind; reason = evidence.observedFailure;
    } else if (evidence.kind === 'retry' && evidence.full === true && evidence.retries === 1 && evidence.previous?.complete === true && evidence.previous.full === true
      && evidence.previous.sha === run.head_sha && evidence.previous.environmentKey === evidence.environmentKey
      && evidence.previous.status === 'completed' && evidence.previous.conclusion === 'success') {
      category = 'bounded-flaky-evidence'; reason = 'Наблюдались полный green и failure на одном материале/окружении в одном bounded повторе. Корневая причина не доказана; этот red не PASS.';
    }
  }
  return { schema: 1, run: run.id, attempt: run.run_attempt, sha: run.head_sha, url: run.html_url,
    gateOutcome: run.status === 'completed' && run.conclusion === 'success' ? 'success' : 'not-green', category, reason, locations };
}
export function diagnosticLines(report) {
  return [`Диагноз: ${report.category} — ${report.reason}`, ...report.locations.flatMap(l => [
    `Job ${l.job}: ${l.url || 'URL отсутствует'}`, ...l.steps.map(s => `Step ${s.number} «${s.name}» (${s.conclusion}): ${s.url || 'URL отсутствует'}`),
  ])];
}
