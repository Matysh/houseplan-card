import { createHash } from 'node:crypto';
import { readTaskReleaseMilestone } from './release-data.mjs';
import { pendingReviewPublications } from './queue.mjs';

const labelNames = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
const keyHash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
const reasonText = reason => ({
  'checks-failed': 'Адресные проверки S6 не прошли. Нужно разобрать указанные отказы и исправить их причину; сам факт падения ещё не доказывает ошибку продукта.',
  'checks-unavailable': 'Проверки не завершились: требуемое окружение или запуск недоступны. Это не успешный результат тестов.',
  'rebase-conflict': 'При актуализации ветки возник конфликт с dev. Исполнитель разрешает конфликт на S6, затем повторно входит в очередь.',
  'review-findings': 'Код-ревью запросило исправления. Исполнитель исправляет замечания из полного отчёта ревью.',
  'review-retry-exhausted': 'Код-ревью не завершилось после разрешённой технической попытки. Это не отрицательный содержательный вердикт; требуется восстановить запуск.',
  'executor-admission-expired': 'Исполнитель перестал продлевать допуск. Чтобы продолжить, нужно восстановить работу исполнителя и повторно запустить finish.',
}[reason] ?? (reason?.startsWith('automation-timeout:')
  ? 'Одна и та же служебная ошибка не устраняется; слот освобождён для других задач. Требуется разобраться с указанной операцией.'
  : 'Исполнитель остановил завершение задачи: перед передачей дальше требуется устранить указанную причину.'));
const statusLabel = issue => labelNames(issue).find(name => /^S[1-8]-/.test(name));
const code = text => `\`${String(text).replaceAll('`', '\\`')}\``;
function currentStatusText(current, from, to) {
  if (current.state === 'closed') return 'Задача уже закрыта; текущий статус не изменён.';
  const actual = statusLabel(current);
  if (actual === to && from && from !== to)
    return `Переведена **${from.slice(0, 2)} → ${to.slice(0, 2)}**: ${code(from)} → ${code(to)}.`;
  return actual ? `Статус остаётся **${actual.slice(0, 2)}** (${code(actual)}).`
    : 'Текущая метка статуса отсутствует; переход не подтверждён.';
}
function milestoneText(result, current) {
  if (result.milestone === 'not-required') return current.milestone
    ? `Сохранён ранее назначенный milestone ${code(current.milestone.title ?? current.milestone.number)}; новый пользовательский milestone для этой задачи не требуется.`
    : 'Пользовательский milestone для этой задачи не требуется.';
  if (!result.milestone) return `Оформление milestone ожидает исправления: ${result.errors.milestone || result.errors.issue || 'нет данных'}.`;
  return result.milestoneTarget?.milestone ? `Milestone: ${code(result.milestoneTitle ?? result.milestoneTarget.milestone)}.`
    : 'Задача не включается в пользовательский milestone этого цикла.';
}

/** Post-merge bookkeeping only. Missing facts/API access never undo a merge or hold its slot. */
export async function reconcileTaskCompletions({ queue, api, git, eventId, issue, activated = false,
  publishReview, readMilestone = readTaskReleaseMilestone, limit = 20, deferredIssues = [] } = {}) {
  const { state } = await queue.store.read();
  if (!activated) return { planned: true, completed: [], pending: [] };
  const deferred = new Set(deferredIssues);
  const selected = number => issue === undefined || Number(number) === issue;
  const all = Object.values(state.tasks).filter(task => selected(task.issue));
  const specs = Object.entries(state.specReviews ?? {}).filter(([number]) => selected(number));
  const outcomes = { completed: [], pending: [], notices: [], reviews: [] };
  const save = event => queue.dispatch({ id: `${eventId}:${event.type}:${event.issue}:${event.kind ?? ''}:${event.requestId ? keyHash(`${event.requestId}:${event.resultKey ?? ''}`) : ''}`, ...event });
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
  const pendingPresentations = pendingReviewPublications(state);
  const requested = publishReview ? pendingPresentations.filter(record => selected(record.issue) && !deferred.has(record.issue)) : [];
  const groups = batch([...new Set(requested.map(record => record.issue))]);
  const quota = Math.max(1, Math.floor(limit / (groups.length || 1)));
  const order = record => Date.parse(record.presentation?.occurredAt ?? record.occurredAt ?? '') || Number(record.runId) || 0;
  const presentations = groups.flatMap(number => requested.filter(record => record.issue === number)
    .sort((a, b) => order(a) - order(b)).slice(0, quota));
  const deferredReports = new Set();
  const deliveredReviews = new Set();
  const reviewKey = record => `${record.kind}:${record.issue}:${record.requestId}:${record.resultKey ?? ''}`;
  for (const record of presentations) {
    if (deferredReports.has(record.issue)) continue;
    try {
      const result = await publishReview(record);
      if (result?.pending && !result.published) {
        deferredReports.add(record.issue);
        outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'pending' }); continue;
      }
      if (!result?.published) throw Error('Review presentation is still pending');
      await save({ type: 'review-presentation', issue: record.issue, kind: record.kind,
        requestId: record.requestId, ...(record.resultKey ? { resultKey: record.resultKey } : {}), status: 'delivered' });
      deliveredReviews.add(reviewKey(record));
      outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'delivered' });
    } catch (error) {
      deferredReports.add(record.issue);
      await save({ type: 'review-presentation', issue: record.issue, kind: record.kind,
        requestId: record.requestId, ...(record.resultKey ? { resultKey: record.resultKey } : {}), status: 'pending', reason: error.message });
      outcomes.reviews.push({ issue: record.issue, kind: record.kind, status: 'pending', reason: error.message });
    }
  }
  for (const task of batch(all.filter(task => task.notice?.status === 'pending' && !task.notice.eventId && !deferred.has(task.issue)))) {
    try {
      const requestId = task.notice.requestId ?? task.reviewRequest;
      const matchingReviews = pendingPresentations.filter(record => record.issue === task.issue && record.kind === 'code'
        && (!requestId || record.requestId === requestId));
      // The full verdict already explains the return. Do not publish a second generic outcome.
      if (task.notice.reason === 'review-findings' && (requestId || matchingReviews.length)) {
        if (matchingReviews.some(record => !deliveredReviews.has(reviewKey(record)))) continue;
        await save({ type: 'task-notice', issue: task.issue, key: task.notice.key, status: 'delivered' });
        outcomes.notices.push({ issue: task.issue, status: 'delivered', includedInReview: true }); continue;
      }
      const current = await api.getIssue(task.issue);
      const detail = task.notice.detail ?? task.automationDetail;
      const known = ['checks-failed', 'checks-unavailable', 'rebase-conflict', 'review-findings', 'review-retry-exhausted', 'executor-admission-expired'].includes(task.notice.reason);
      const late = task.notice.entry !== undefined && task.notice.entry !== task.reviewEntry
        || task.queued || state.active?.issue === task.issue || current.state === 'closed' || task.status !== 'S6-in-progress';
      await api.upsertComment(task.issue, {
        marker: `<!-- process-next-task-return:${task.issue}:${keyHash(task.notice.key)} -->`,
        body: `## ${late ? 'Сохранённое сообщение о возврате' : 'Завершение приостановлено'} — задача #${task.issue}, вход ${task.notice.entry ?? task.reviewEntry ?? 'не записан'}\n\n`
          + (task.notice.at ? `Время события: ${new Date(task.notice.at).toISOString()} (UTC).\n\n` : '')
          + `${currentStatusText(current, !late && task.notice.transitionConfirmed === true ? task.notice.fromStatus : null, 'S6-in-progress')} При этом возврате слот очереди был освобождён.\n\n${reasonText(task.notice.reason)}\n\n`
          + (detail ? `Подробности: ${code(detail)}.\n\n` : !known ? `Причина остановки: ${code(task.notice.reason)}.\n\n` : '')
          + (task.notice.reportUrl ? `[Результат запуска](${task.notice.reportUrl}).\n\n` : '')
          + (late ? 'Сообщение доставлено после изменения состояния задачи. Текущее состояние не изменяется; указанные действия относятся к прежнему входу в очередь.'
            : 'Успешные применимые результаты сохранены. После устранения причины — повторный вход через `finish`; проверяются исправление и связанная область, а не весь набор заново.'),
      });
      await save({ type: 'task-notice', issue: task.issue, key: task.notice.key, status: 'delivered' });
      outcomes.notices.push({ issue: task.issue, status: 'delivered' });
    } catch (error) { outcomes.notices.push({ issue: task.issue, status: 'pending', reason: error.message }); }
  }
  for (const [number, spec] of batch(specs.filter(([number, value]) => value.notice?.status === 'pending' && !value.notice.eventId && !deferred.has(Number(number))))) {
    try {
      await api.upsertComment(Number(number), { marker: `<!-- process-next-spec-attention:${number}:${keyHash(spec.notice.key)} -->`,
        body: `## Ревью ТЗ задачи #${number} остановлено: технический повтор исчерпан\n\n`
          + `${currentStatusText(await api.getIssue(Number(number)), null, 'S4-spec-review')}\n\n`
          + `Ревью не завершилось после разрешённого повтора. Это **не отрицательный содержательный вердикт**. Требуется разобраться со служебным сбоем запуска.\n\n`
          + (spec.reportUrl ? `[Последний запуск](${spec.reportUrl}).\n\n` : '')
          + 'Уже сохранённый отчёт публикуется без повторного вызова модели; если отчёт не получен, продолжение требует восстановления запуска.',
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
    if (classificationUnchanged && result.labels && result.comment && result.commentCurrent && !result.pendingComment) {
      outcomes.pending.push({ issue: task.issue, ...result }); continue;
    }
    let current;
    try { current = await api.getIssue(task.issue); delete result.errors.issue; }
    catch (error) { result.errors.issue = error.message; }
    if (current) {
      if (!result.labels) try {
        const labels = labelNames(current);
        result.labelsFrom ??= task.mergedFromStatus ?? statusLabel(current) ?? null;
        result.removedToRelease ??= task.removedToRelease ?? labels.includes('to_release');
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
        if (current.milestone?.number === facts.milestone) result.milestoneTitle = current.milestone.title ?? facts.milestone;
        result.milestone = true; delete result.errors.milestone;
      } catch (error) { result.errors.milestone = error.message; }
      const facts = { labels: result.labels, milestone: result.milestone, target: result.milestoneTarget?.milestone ?? null };
      const commentDigest = keyHash(JSON.stringify(facts));
      result.commentCurrent = !!result.comment && result.commentDigest === commentDigest;
      // Publication order affects comments only. Labels/milestone above are
      // repaired even when an earlier report or service message is unavailable.
      const publicationDeferred = deferred.has(task.issue) || !!publishReview && pendingPresentations.some(record =>
        record.issue === task.issue && !deliveredReviews.has(reviewKey(record)));
      if (!publicationDeferred) try {
        const repoUrl = `https://github.com/${api.owner}/${api.repo}`;
        // A failed response keeps the exact pending payload. A later recovery gets
        // its own event marker instead of rewriting the original merge message.
        if (!result.pendingComment && (!result.comment || result.commentDigest !== commentDigest)) {
          const confirmed = result.labels ? { ...current, labels: current.state === 'closed' ? current.labels : ['S8-merged'] } : current;
          const newlyConfirmedLabels = !result.comment || result.commentFacts?.labels === false;
          const body = (result.comment ? '## Оформление после слияния обновлено\n\n' : `## Задача #${task.issue} слита в dev\n\n`)
            + `Изменение принято: [${task.mergedSha.slice(0, 9)}](${repoUrl}/commit/${task.mergedSha}).\n\n`
            + (result.labels ? currentStatusText(confirmed, newlyConfirmedLabels ? result.labelsFrom : null, 'S8-merged')
              : `Обновление меток пока не удалось: ${result.errors.labels || 'не подтверждено'}. ${currentStatusText(current)}`)
            + (result.labels && result.removedToRelease && newlyConfirmedLabels ? '\nСнята личная метка `to_release`.' : '')
            + (task.branchDeleted && !result.comment ? `\nРабочая ветка ${code(task.branch)} удалена.` : '')
            + `\n\n${milestoneText(result, current)}\n\n`
            + (task.track === 'ship' && !result.comment ? 'Индивидуальное ревью не предусмотрено установленным треком ship.\n' : '')
            + 'Восстанавливается только служебное оформление; слияние, проверки и ревью не повторяются.';
          result.pendingComment = {
            marker: `<!-- process-next-task-merged:${task.issue}:${task.mergedSha}${result.comment ? `:update:${commentDigest}` : ''} -->`,
            body, digest: commentDigest, facts,
          };
        }
        if (result.pendingComment) {
          await api.upsertComment(task.issue, result.pendingComment);
          result.comment = true; result.commentDigest = result.pendingComment.digest;
          result.commentFacts = result.pendingComment.facts; delete result.pendingComment;
        }
        result.commentCurrent = result.commentDigest === commentDigest;
        delete result.errors.comment;
      } catch (error) { result.commentCurrent = false; result.errors.comment = error.message; }
    }
    result.status = result.labels && result.milestone && result.comment && result.commentCurrent ? 'complete' : 'pending';
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
