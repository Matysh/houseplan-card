import { createHash } from 'node:crypto';

const statusNames = {
  'S1-new': 'Новая', 'S2-analysis': 'Анализ', 'S3-spec': 'Подготовка ТЗ',
  'S4-spec-review': 'Ревью ТЗ', 'S5-ready': 'Готова',
  'S6-in-progress': 'Реализация и проверки', 'S7-code-review': 'Код-ревью', 'S8-merged': 'Слито в dev',
};
const code = value => `\`${String(value).replaceAll('`', '')}\``;
const statusText = value => statusNames[value] ? `${value.slice(0, 2)} «${statusNames[value]}»` : value;
const currentStatus = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name)
  .find(label => Object.hasOwn(statusNames, label));
const timeText = at => Number.isFinite(at) ? new Date(at).toISOString() : 'время не сохранено';
const link = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href.replaceAll(')', '%29') : null; }
  catch { return null; }
};
const returnReasons = {
  'checks-failed': 'Адресные проверки S6 не прошли. Нужно разобрать отказы и исправить причину; само падение ещё не доказывает ошибку продукта.',
  'checks-unavailable': 'Проверки не завершились: требуемое окружение или запуск недоступны. Это не успешный результат тестов.',
  'rebase-conflict': 'При актуализации возник конфликт с dev. Исполнитель разрешает его на S6, затем повторно входит в очередь.',
  'review-retry-exhausted': 'Код-ревью не завершилось после разрешённого технического повтора. Это не отрицательный содержательный вердикт; требуется восстановить запуск.',
  'executor-admission-expired': 'Исполнитель перестал продлевать допуск. Нужно восстановить работу исполнителя и повторно запустить finish.',
};

function evidenceText(message) {
  if (message.layer === 'docs') return 'Изменены только документы. Тесты, сборка и линтеры не требуются; прогонов не было.';
  const evidence = message.evidence;
  if (!evidence) return 'Выбранные адресные проверки S6 завершились успешно.';
  const records = Array.isArray(evidence) ? evidence : [evidence];
  return records.map(record => {
    const lines = [record.name ? `Набор **${record.name}** завершился успешно.` : 'Выбранные адресные проверки S6 завершились успешно.'];
    if (Number.isFinite(record.durationMs)) lines.push(`Фактическое время: ${(record.durationMs / 1000).toFixed(1)} с.`);
    if (record.environment) lines.push(`Среда: ${record.environment}.`);
    if (Array.isArray(record.results) && record.results.length) {
      const executed = record.results.filter(row => row.status === 'passed');
      const reused = record.results.filter(row => row.status === 'reused');
      if (executed.length) lines.push(`Выполнены: ${executed.map(row => row.name ?? row.id).join(', ')}.`);
      if (reused.length) lines.push(`Зачтены прежние результаты: ${reused.map(row => row.name ?? row.id).join(', ')}.`);
    }
    if (Number.isSafeInteger(record.counts?.tests)) lines.push(`Тест-кейсов: ${record.counts.tests}.`);
    const reportUrl = link(record.reportUrl);
    if (reportUrl) lines.push(`[Результат проверок](${reportUrl}).`);
    else if (record.reportPath) lines.push(`Локальный отчёт: ${code(record.reportPath)}.`);
    return lines.join(' ');
  }).join('\n\n');
}

function renderMessage(message, issue, state) {
  if (message.kind === 'return' && message.notice) message = { ...message, ...message.notice, toStatus: 'S6-in-progress' };
  if (message.kind === 'spec-attention' && message.notice) message = { ...message, ...message.notice, toStatus: 'S4-spec-review' };
  const specNotice = ['spec-attention', 'spec-replaced', 'spec-skipped'].includes(message.kind);
  const actual = currentStatus(issue), task = specNotice ? state.specReviews?.[message.issue] : state.tasks?.[message.issue];
  const active = state.active?.issue === message.issue ? state.active : null;
  const expected = message.toStatus ?? (specNotice ? 'S4-spec-review' : message.kind === 'dev-build' ? 'S8-merged'
    : ['admitted', 's6-complete'].includes(message.kind) && message.phase === 'review' ? 'S7-code-review'
      : message.kind === 'admitted' && message.phase === 'ready-to-merge' ? task?.status ?? actual : 'S6-in-progress');
  const laterEntry = message.kind === 'spec-attention' ? !!task?.requestId && task.requestId !== message.key
    : message.kind === 'spec-replaced' ? Number.isSafeInteger(task?.round) && task.round !== message.round
    : task?.reviewEntry !== undefined && message.entry !== undefined && task.reviewEntry !== message.entry;
  const laterPhase = !specNotice && !!task && (message.kind === 'queued' ? !state.waiting?.includes(message.issue)
    : message.kind === 'return' ? !!task.queued || !!active
      : message.kind !== 'dev-build' && (!active || message.phase && message.phase !== active.phase));
  const delayed = issue.state === 'closed' || !!actual && actual !== expected || laterEntry || laterPhase;
  const status = issue.state === 'closed' ? 'Задача уже закрыта; текущий статус не изменён.'
    : message.transitionConfirmed && !delayed && actual === message.toStatus && message.fromStatus && message.fromStatus !== actual
      ? `Переведена **${statusText(message.fromStatus)} → ${statusText(actual)}**: ${code(message.fromStatus)} → ${code(actual)}.`
      : actual ? `${delayed ? 'Текущий статус' : 'Статус остаётся'} **${statusText(actual)}** (${code(actual)}).`
        : 'Текущая метка статуса отсутствует; переход не подтверждён.';
  const entry = message.entry === undefined ? '' : ` — вход ${message.entry}`;
  let title, detail, next;
  switch (message.kind) {
    case 'spec-skipped':
      title = `Задача №${message.issue} готова к реализации`;
      detail = `Для установленного трека ${code(message.track)} отдельное ревью ТЗ не предусмотрено. Этап пропущен, а не объявлен успешно выполненным.`;
      next = 'начать реализацию на S6';
      break;
    case 'queued':
      title = `Задача №${message.issue} поставлена в очередь завершения${entry}`;
      detail = 'Работа передана на финальную актуализацию относительно dev и подготовку S6.';
      next = message.track === 'ship' ? 'после допуска завершить короткий S6 и выполнить слияние; индивидуальное ревью для ship не предусмотрено'
        : 'после допуска завершить S6 и передать материал на код-ревью';
      if (message.layer === 'docs') detail += ' Изменены только документы; прогонов нет.';
      break;
    case 'admitted':
      title = `Получен слот очереди для задачи №${message.issue}${entry}`;
      if (message.phase === 'review') {
        detail = 'Возобновлено получение результата уже запрошенного код-ревью. Актуализация и проверки S6 заново не запускаются.';
        next = 'дождаться результата этого ревью; после принятия — слияние';
      } else if (message.phase === 'ready-to-merge') {
        detail = 'Возобновлено слияние уже подготовленной задачи. Применимые результаты S6 сохранены. '
          + (message.track === 'ship' ? 'Индивидуальное ревью для ship не предусмотрено.' : 'Принятое ревью сохранено.');
        next = 'выполнить слияние; повторные проверки и вызов модели не требуются';
      } else {
        detail = 'Начат финальный участок завершения: ветка актуализируется относительно dev при необходимости.';
        next = message.layer === 'docs' ? 'завершить подготовку без тестов, сборки и линтеров'
          : 'выполнить выбранные адресные проверки S6; подробный прогресс остаётся в окне запуска и логе';
      }
      break;
    case 's6-complete':
      title = message.layer === 'docs' ? `Подготовка задачи №${message.issue} завершена — прогонов нет`
        : `Проверки S6 задачи №${message.issue} завершены`;
      detail = evidenceText(message);
      next = message.phase === 'review' ? 'ожидаем ревьюера; затем выполняется только содержательное код-ревью'
        : message.track === 'ship' ? 'слияние в dev; индивидуальное ревью для ship не предусмотрено'
          : 'слияние в dev; ранее принятое применимое ревью зачтено, новый вызов модели не требуется';
      break;
    case 'resynchronize':
      title = `Задаче №${message.issue} требуется повторная актуализация относительно dev${entry}`;
      detail = 'Основание ветки изменилось перед слиянием. Сохранённые результаты не отменены автоматически.';
      next = 'актуализировать ветку, определить применимость прежних результатов и проверить только необходимое; при изменении собственного кода потребуется новый раунд ревью';
      break;
    case 'return': {
      if (message.reason === 'review-findings') throw Error('Review findings belong in the complete review report');
      title = `${delayed ? 'Сохранённое сообщение о возврате' : 'Завершение приостановлено'} — задача №${message.issue}${entry}`;
      detail = 'При этом возврате слот очереди был освобождён. '
        + (returnReasons[message.reason] ?? (message.reason?.startsWith('automation-timeout:')
          ? 'Одна и та же служебная ошибка не устраняется; требуется разбор указанной операции.'
          : 'Исполнитель остановил завершение: перед передачей дальше требуется устранить указанную причину.'));
      if (message.detail) detail += `\n\nПодробности: ${code(message.detail)}.`;
      else if (!Object.hasOwn(returnReasons, message.reason)) detail += `\n\nПричина остановки: ${code(message.reason ?? 'не записана')}.`;
      const reportUrl = link(message.reportUrl);
      if (reportUrl) detail += `\n\n[Результат запуска](${reportUrl}).`;
      next = 'устранить указанную причину на S6 и повторно войти через finish; применимые успешные результаты сохраняются';
      break;
    }
    case 'spec-attention': {
      title = `Ревью ТЗ задачи №${message.issue} остановлено из-за технического сбоя`;
      detail = 'Ревью ТЗ не завершилось после разрешённого технического повтора. Это не отрицательное ревью ТЗ: содержательный вердикт не получен.';
      if (message.detail || message.reason) detail += `\n\nПричина: ${code(message.detail ?? message.reason)}.`;
      const reportUrl = link(message.reportUrl);
      if (reportUrl) detail += `\n\n[Последний запуск](${reportUrl}).`;
      next = 'разобрать служебный сбой и восстановить запуск; если результат уже сохранён, повторить только его публикацию, без нового вызова модели';
      break;
    }
    case 'spec-replaced':
      title = `Материал ТЗ задачи №${message.issue} изменён${message.round ? ` — раунд ${message.round}` : ''}`;
      detail = `Тело задачи изменено во время S4: вместо предыдущей редакции${message.previousRound ? ` (раунд ${message.previousRound})` : ''} передана новая редакция${message.round ? ` для раунда ${message.round}` : '; номер старого раунда не был сохранён'}. `
        + 'Это новый материал, а не технический повтор. Предыдущий запрос сохранён; его результат публикуется отдельно, когда становится доступен.';
      next = 'получить содержательное ревью новой редакции; прежний отчёт остаётся в истории и не заменяется новым вердиктом';
      break;
    case 'dev-build':
      title = `Изменение задачи №${message.issue} доставлено в dev-build`;
      detail = 'Публикация сборки на ветке dev-build подтверждена. Это не подтверждает, что браузер стенда уже загрузил обновление.';
      next = 'обычная работа со стендом; слияние, проверки и ревью задачи повторно не выполняются';
      break;
    default: throw Error(`Unknown service message kind: ${message.kind}`);
  }
  const lines = [`**${title}**`, status, `Событие: ${timeText(message.at)}.`, detail];
  if (message.materialSha) lines.push(`Материал: ${code(message.materialSha)}.`);
  if (delayed) lines.push('Состояние задачи на момент публикации отличается от состояния этого события. Сообщение сохраняет историю, не объявляет неподтверждённый переход выполненным и не откатывает текущий статус.');
  lines.push(`${delayed ? 'Следующий шаг на момент события' : 'Далее'} — ${next}.`);
  return lines.join('\n\n');
}

/** Publish pending messages from the existing delivery records; never alter task readiness. */
export async function publishServiceMessages({ queue, api, eventId, onlyMessageIds }) {
  const outcomes = { published: [], pending: [] };
  const selected = onlyMessageIds === undefined ? null : new Set(onlyMessageIds);
  let state;
  try { ({ state } = await queue.store.read()); }
  catch (error) { return { ...outcomes, pending: [{ reason: error.message }] }; }
  const blockedIssues = new Set();
  for (const [messageId, record] of Object.entries(state.events ?? {})) {
    const message = record?.message;
    if (!message || message.delivered || selected && !selected.has(messageId)) continue;
    const identity = { issue: message.issue, messageId };
    if (blockedIssues.has(message.issue)) {
      outcomes.pending.push({ ...identity, reason: 'Сначала ожидает публикации предыдущее событие этой задачи.' }); continue;
    }
    try {
      const issue = await api.getIssue(message.issue);
      const digest = createHash('sha256').update(messageId).digest('hex');
      await api.upsertComment(message.issue, {
        marker: `<!-- process-next-event:${digest} -->`, body: renderMessage(message, issue, state),
      });
      if (message.kind === 'return' && message.notice?.key) await queue.dispatch({
        id: `${eventId}:notice:${digest}`, type: 'task-notice', issue: message.issue, key: message.notice.key, status: 'delivered',
      });
      if (message.kind === 'spec-attention' && message.notice?.key) await queue.dispatch({
        id: `${eventId}:spec-notice:${digest}`, type: 'spec-notice', issue: message.issue, key: message.notice.key, status: 'delivered',
      });
      await queue.dispatch({ id: `${eventId}:message:${digest}`, type: 'message-delivered', messageId });
      outcomes.published.push(identity);
    } catch (error) {
      blockedIssues.add(message.issue);
      outcomes.pending.push({ ...identity, reason: error.message });
    }
  }
  return outcomes;
}
