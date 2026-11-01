import { createHash } from 'node:crypto';
import { readTaskReleaseMilestone } from './release-data.mjs';
import { pendingReviewPublications } from './queue.mjs';

const labelNames = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
const keyHash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
const reasonText = reason => ({
  'checks-failed': 'Адресные проверки нашли ошибку. Исполнитель исправляет её на S6.',
  'checks-unavailable': 'Проверки не завершились из-за недоступного окружения.',
  'rebase-conflict': 'При актуализации возник конфликт. Исполнитель разрешает его на S6.',
  'review-findings': 'Ревью запросило исправления. Подробности находятся в отчёте ревью.',
  'review-retry-exhausted': 'Ревью не завершилось после разрешённого повтора. Нужен разбор служебного сбоя.',
  'executor-admission-expired': 'Исполнитель перестал продлевать допуск. Задача освобождена из очереди; повторный вход — finish.',
}[reason] ?? `Служебная причина: ${reason}.`);

/** Post-merge bookkeeping only. Missing facts/API access never undo a merge or hold its slot. */
export async function reconcileTaskCompletions({ queue, api, git, eventId, issue, activated = false,
  publishReview, readMilestone = readTaskReleaseMilestone, limit = 20 } = {}) {
  const { state } = await queue.store.read();
  if (!activated) return { planned: true, completed: [], pending: [] };
  const all = Object.values(state.tasks).filter(task => issue === undefined || task.issue === issue);
  const specs = Object.entries(state.specReviews ?? {}).filter(([number]) => issue === undefined || Number(number) === issue);
  const outcomes = { completed: [], pending: [], notices: [], reviews: [] };
  const save = event => queue.dispatch({ id: `${eventId}:${event.type}:${event.issue}:${event.kind ?? ''}:${event.requestId ? keyHash(event.requestId) : ''}`, ...event });
  // Rotate bounded work using the existing ten-minute scheduler window. An old
  // failure cannot starve newer work, and visiting a row needs no persisted timestamp.
  const batch = rows => {
    if (!rows.length || limit < 1) return [];
    const start = Math.floor(queue.clock() / 600_000) * limit % rows.length;
    return [...rows.slice(start), ...rows.slice(0, start)].slice(0, limit);
  };
  let devHeadRequest;
  const devHead = () => devHeadRequest ??= git.remoteHead ? git.remoteHead(git.dev ?? 'dev') : Promise.resolve(null);

  // Retried presentation reads the already-paid result. It does not move task/spec statuses.
  // Only the serialized coordinator supplies the publisher; ordinary finish is read-only here.
  const presentations = publishReview ? batch(pendingReviewPublications(state).filter(record => issue === undefined || record.issue === issue)) : [];
  for (const record of presentations) {
    try {
      const result = await publishReview(record);
      if (result?.pending && !result.published) {
        outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'pending' }); continue;
      }
      if (!result?.published) throw Error('Review presentation is still pending');
      await save({ type: 'review-presentation', issue: record.issue, kind: record.kind,
        requestId: record.requestId, status: 'delivered' });
      outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'delivered' });
    } catch (error) {
      await save({ type: 'review-presentation', issue: record.issue, kind: record.kind,
        requestId: record.requestId, status: 'pending', reason: error.message });
      outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'pending', reason: error.message });
    }
  }
  for (const task of batch(all.filter(task => task.notice?.status === 'pending'))) {
    try {
      await api.upsertComment(task.issue, {
        marker: `<!-- process-next-task-return:${task.issue}:${keyHash(task.notice.key)} -->`,
        body: `Задача #${task.issue} возвращена исполнителю; слот очереди освобождён.\n\n${reasonText(task.notice.reason)}\n\nУспешные применимые результаты сохраняются. Повторный вход после исправления причины: \`finish\`.`,
      });
      await save({ type: 'task-notice', issue: task.issue, key: task.notice.key, status: 'delivered' });
      outcomes.notices.push({ issue: task.issue, status: 'delivered' });
    } catch (error) { outcomes.notices.push({ issue: task.issue, status: 'pending', reason: error.message }); }
  }
  for (const [number, spec] of batch(specs.filter(([, value]) => value.notice?.status === 'pending'))) {
    try {
      await api.upsertComment(Number(number), { marker: `<!-- process-next-spec-attention:${number}:${keyHash(spec.notice.key)} -->`,
        body: `Ревью ТЗ задачи #${number} не завершилось после разрешённого повтора. Нужен разбор служебного сбоя.\n\nЭто не отрицательное ревью ТЗ: статус S4 сохраняется. Уже полученный результат не требует повторного вызова модели ради его публикации.`,
      });
      await save({ type: 'spec-notice', issue: Number(number), key: spec.notice.key, status: 'delivered' });
      outcomes.notices.push({ issue: Number(number), kind: 'spec', status: 'delivered' });
    } catch (error) { outcomes.notices.push({ issue: Number(number), kind: 'spec', status: 'pending', reason: error.message }); }
  }
  const tasks = batch(all.filter(task => task.status === 'S8-merged' && task.completion?.status !== 'complete'));
  for (const task of tasks) {
    const result = { labels: false, milestone: false, comment: false, ...task.completion,
      status: 'pending', errors: { ...task.completion?.errors } };
    delete result.lastAttemptAt;
    if (task.releaseTag || ['docs', 'infra'].includes(task.layer)) {
      result.milestone = 'not-required'; delete result.errors.milestone;
      delete result.classificationAt; delete result.milestoneTarget;
    }
    let classificationUnchanged = false;
    if (!result.milestone && result.classificationAt) try {
      classificationUnchanged = result.classificationAt === await devHead();
    } catch { /* A failed head read is retryable; it must not pin missing input forever. */ }
    if (classificationUnchanged && result.labels && result.comment) {
      outcomes.pending.push({ issue: task.issue, ...result }); continue;
    }
    let current;
    try { current = await api.getIssue(task.issue); delete result.errors.issue; }
    catch (error) { result.errors.issue = error.message; }
    if (current) {
      if (!result.labels) try {
        const labels = labelNames(current);
        if (current.state !== 'closed' && (labels.filter(name => /^S[1-8]-/.test(name)).join() !== 'S8-merged'))
          await api.moveStatus(task.issue, 'S8-merged', current.labels);
        else if (labels.includes('to_release')) await api.removeLabel(task.issue, 'to_release');
        result.labels = true; delete result.errors.labels;
      } catch (error) { result.errors.labels = error.message; }
      if (!result.milestone && !classificationUnchanged) try {
        if (!result.milestoneTarget) {
          if (git.ensureCommit) await git.ensureCommit(task.mergedSha);
          let facts = await readMilestone({ git, materialSha: task.mergedSha, issue: task.issue }), fallbackSha;
          if (facts.status !== 'ready') {
            fallbackSha = await devHead();
            if (fallbackSha && fallbackSha !== task.mergedSha) {
              if (git.ensureCommit) await git.ensureCommit(fallbackSha);
              // A later repair fills only the original cycle, never the newest cycle.
              facts = await readMilestone({ git, materialSha: task.mergedSha, issue: task.issue, fallbackSha });
            }
          }
          if (facts.status !== 'ready') {
            if (fallbackSha) result.classificationAt = fallbackSha;
            throw Error(facts.reason || 'Release classification is missing');
          }
          result.milestoneTarget = { milestone: facts.milestone, cycleMilestone: facts.cycleMilestone };
          delete result.classificationAt;
        }
        const facts = result.milestoneTarget;
        const assigned = current.milestone?.number ?? null;
        if (facts.milestone !== null && assigned !== null && assigned !== facts.milestone)
          throw Error('Issue already belongs to another milestone; keep it until the owner resolves the conflict');
        if (facts.milestone !== null && assigned !== facts.milestone
          || facts.milestone === null && assigned === facts.cycleMilestone)
          await api.updateIssue(task.issue, { milestone: facts.milestone });
        result.milestone = true; delete result.errors.milestone;
      } catch (error) { result.errors.milestone = error.message; }
      try {
        const repoUrl = `https://github.com/${api.owner}/${api.repo}`;
        const body = `Задача #${task.issue} слита в dev: [${task.mergedSha.slice(0, 9)}](${repoUrl}/commit/${task.mergedSha}). Рабочая ветка \`${task.branch}\` удалена.\n\n`
            + (result.labels ? (current.state === 'closed' ? 'Задача уже закрыта; статус S8 не возвращается.\n'
              : 'Статус S8 установлен; личная метка `to_release` снята, если была.\n') : 'Обновление меток ожидает повтора.\n')
            + (result.milestone === 'not-required' ? 'Пользовательский milestone для этой задачи не требуется.'
              : result.milestone ? 'Учёт milestone завершён.' : `Учёт milestone ожидает исправления: ${result.errors.milestone || result.errors.issue || 'нет данных'}.`)
            + '\nПовтор служебного действия не повторяет слияние, тесты или ревью.';
        const commentDigest = keyHash(body);
        if (!result.comment || result.commentDigest !== commentDigest) await api.upsertComment(task.issue, {
          marker: `<!-- process-next-task-merged:${task.issue}:${task.mergedSha} -->`, body,
        });
        result.comment = true; result.commentDigest = commentDigest; delete result.errors.comment;
      } catch (error) { result.comment = false; result.errors.comment = error.message; }
    }
    result.status = result.labels && result.milestone && result.comment ? 'complete' : 'pending';
    await save({ type: 'task-completion', issue: task.issue, materialSha: task.mergedSha, result });
    outcomes[result.status === 'complete' ? 'completed' : 'pending'].push({ issue: task.issue, ...result });
  }
  return outcomes;
}

/** Retry only the optional HA wakeup; no build, Git publication or test execution occurs here. */
export async function notifyDevWebhook({ queue, url, fetchImpl = globalThis.fetch, eventId, activated = false,
  timeoutMs = 20_000 } = {}) {
  const { state } = await queue.store.read(), pending = state.devWebhook;
  if (!activated) return { planned: true, status: pending?.status ?? 'not-required' };
  if (pending?.status !== 'pending') return { status: pending?.status ?? 'not-required' };
  if (!url) return { status: 'pending', reason: 'HA webhook secret is unavailable' };
  let endpoint;
  try { endpoint = new URL(url); if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw Error(); }
  catch { return { status: 'pending', reason: 'HA webhook configuration is invalid' }; }
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: pending.sourceSha }), signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok) throw Error('HTTP refusal');
    await response.body?.cancel();
    await queue.dispatch({ id: `${eventId}:delivered`, type: 'dev-webhook', sourceSha: pending.sourceSha, status: 'delivered' });
    return { status: 'delivered', sourceSha: pending.sourceSha };
  } catch {
    // URLs and arbitrary response/error text can contain the webhook secret.
    return { status: 'pending', reason: 'HA webhook did not confirm delivery; only the wakeup will be retried' };
  }
}
