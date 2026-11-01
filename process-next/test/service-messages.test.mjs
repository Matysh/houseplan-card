import test from 'node:test';
import assert from 'node:assert/strict';
import { publishServiceMessages } from '../lib/service-messages.mjs';

const SHA = 'a'.repeat(40);
function fixture(messages, { status = 'S6-in-progress', tasks = {}, specReviews = {}, active = null, waiting = [] } = {}) {
  const state = { events: Object.fromEntries(messages.map((message, index) => [`event-${index}`, { digest: 'original', message: {
    issue: 9, at: Date.UTC(2026, 10, 1, 12), entry: 1, layer: 'infra', track: 'ask', materialSha: SHA, ...message,
  } }])), tasks, specReviews, active, waiting };
  const issue = { number: 9, state: 'open', labels: [status] };
  const comments = new Map(), deliveries = [];
  let postFailure = false, acknowledgementFailure = false;
  const queue = { store: { read: async () => ({ state: structuredClone(state) }) }, dispatch: async event => {
    assert.ok(['message-delivered', 'task-notice', 'spec-notice'].includes(event.type));
    if (acknowledgementFailure) { acknowledgementFailure = false; throw Error('acknowledgement lost'); }
    deliveries.push(event);
    if (event.type === 'message-delivered') state.events[event.messageId].message.delivered = true;
    else {
      const owner = event.type === 'spec-notice' ? state.specReviews[event.issue] : state.tasks[event.issue];
      if (owner?.notice?.key === event.key) owner.notice.status = event.status;
    }
  } };
  const api = { getIssue: async number => ({ ...issue, number }), upsertComment: async (number, comment) => {
    if (postFailure) { postFailure = false; throw Error('GitHub unavailable'); }
    if (!comments.has(comment.marker)) comments.set(comment.marker, { number, body: comment.body });
    return { id: [...comments.keys()].indexOf(comment.marker) + 1 };
  } };
  let tick = 0;
  return { state, issue, comments, deliveries, api, queue,
    failNextPost() { postFailure = true; }, failNextAcknowledgement() { acknowledgementFailure = true; },
    publish: () => publishServiceMessages({ queue, api, eventId: `tick-${++tick}` }),
    bodies: () => [...comments.values()].map(row => row.body),
  };
}

test('the same delivered event stays one comment and does not dispatch again on idle ticks', async () => {
  const f = fixture([{ kind: 'queued' }]);
  assert.equal((await f.publish()).published.length, 1);
  const previous = f.bodies()[0];
  assert.equal((await f.publish()).published.length, 0);
  assert.equal(f.comments.size, 1); assert.equal(f.deliveries.length, 1); assert.equal(f.bodies()[0], previous);
});

test('a failed publication remains pending and resumes on the next tick', async () => {
  const f = fixture([{ kind: 'admitted' }]); f.failNextPost();
  assert.equal((await f.publish()).pending.length, 1);
  assert.equal(f.state.events['event-0'].message.delivered, undefined);
  assert.equal((await f.publish()).published.length, 1); assert.equal(f.comments.size, 1);
});

test('lost state acknowledgement reuses the comment marker without rewriting history', async () => {
  const f = fixture([{ kind: 'queued' }]); f.failNextAcknowledgement();
  assert.equal((await f.publish()).pending.length, 1); const original = f.bodies()[0];
  f.issue.labels = ['S8-merged']; f.issue.state = 'closed';
  assert.equal((await f.publish()).published.length, 1);
  assert.equal(f.comments.size, 1); assert.equal(f.bodies()[0], original);
});

test('late delivery reports current state without asserting an obsolete status transition', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'review', fromStatus: 'S6-in-progress', toStatus: 'S7-code-review', transitionConfirmed: true }],
    { status: 'S8-merged', tasks: { 9: { status: 'S8-merged', reviewEntry: 1 } } });
  await f.publish(); const body = f.bodies()[0];
  assert.match(body, /Текущий статус \*\*S8/);
  assert.match(body, /Событие: 2026-11-01T12:00:00.000Z/);
  assert.match(body, /Состояние задачи на момент публикации отличается/);
  assert.doesNotMatch(body, /Переведена/);
  assert.match(body, /Следующий шаг на момент события/);
});

test('confirmed transition is shown only while the actual issue status agrees', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'review', fromStatus: 'S6-in-progress', toStatus: 'S7-code-review', transitionConfirmed: true }],
    { status: 'S7-code-review' });
  await f.publish(); assert.match(f.bodies()[0], /Переведена \*\*S6.*→ S7/);
  const unconfirmed = fixture([{ kind: 's6-complete', phase: 'review', fromStatus: 'S6-in-progress', toStatus: 'S7-code-review' }],
    { status: 'S7-code-review' });
  await unconfirmed.publish(); assert.doesNotMatch(unconfirmed.bodies()[0], /Переведена/);
});

test('documentation S6 explicitly states no runs instead of claiming passing tests', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'review', layer: 'docs' }], { status: 'S7-code-review' });
  await f.publish(); const body = f.bodies()[0];
  assert.match(body, /прогонов не было/); assert.match(body, /ожидаем ревьюера/);
  assert.doesNotMatch(body, /проверки S6 завершились успешно/);
});

test('ship S6 goes to merge without a fictional S7 or accepted model review', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'ready-to-merge', track: 'ship', evidence: {
    name: 'Проверки публикации комментариев', durationMs: 3400, reportPath: 'artifacts/process-next/report.json',
    results: [{ id: 'publication', status: 'passed' }, { id: 'syntax', status: 'reused' }],
  } }]);
  await f.publish(); const body = f.bodies()[0];
  assert.match(body, /индивидуальное ревью для ship не предусмотрено/);
  assert.doesNotMatch(body, /S7|ревью зачтено/);
  assert.match(body, /3.4 с/); assert.match(body, /Зачтены прежние результаты: syntax/);
  assert.match(body, /Локальный отчёт: `artifacts\/process-next\/report.json`/);
  assert.doesNotMatch(body, /\]\(artifacts/);
});

test('a failed event preserves order for its issue while other issues can publish', async () => {
  const f = fixture([{ kind: 'queued' }, { kind: 'admitted' }, { kind: 'queued', issue: 10 }]); f.failNextPost();
  const first = await f.publish();
  assert.equal(first.pending.length, 2); assert.deepEqual(first.published.map(row => row.issue), [10]);
  assert.equal((await f.publish()).published.length, 2);
  assert.deepEqual([...f.comments.values()].map(row => row.number), [10, 9, 9]);
  assert.match(f.bodies()[1], /поставлена в очередь/); assert.match(f.bodies()[2], /Получен слот/);
});

test('reentry and later queue phase make an old same-status event explicitly historical', async () => {
  const f = fixture([{ kind: 'queued' }], { tasks: { 9: { reviewEntry: 2 } }, waiting: [9] });
  await f.publish(); assert.match(f.bodies()[0], /Состояние задачи на момент публикации отличается/);
  const advanced = fixture([{ kind: 'admitted', phase: 'sync' }], {
    tasks: { 9: { reviewEntry: 1 } }, active: { issue: 9, phase: 'testing' },
  });
  await advanced.publish(); assert.match(advanced.bodies()[0], /Следующий шаг на момент события/);
});

test('resynchronization and dev-build describe their real operation without promising a browser refresh', async () => {
  const sync = fixture([{ kind: 'resynchronize', phase: 'sync' }]);
  await sync.publish(); assert.match(sync.bodies()[0], /Сохранённые результаты не отменены автоматически/);
  const build = fixture([{ kind: 'dev-build' }], { status: 'S8-merged' });
  await build.publish(); assert.match(build.bodies()[0], /не подтверждает, что браузер/);
  assert.match(build.bodies()[0], /Статус остаётся \*\*S8/);
});

test('readmission resumes review or merge without promising another synchronization or S6', async () => {
  for (const phase of ['review', 'ready-to-merge']) {
    const f = fixture([{ kind: 'admitted', phase }], { status: 'S7-code-review',
      tasks: { 9: { reviewEntry: 1, status: 'S7-code-review' } }, active: { issue: 9, phase } });
    await f.publish(); const body = f.bodies()[0];
    assert.match(body, /Статус остаётся \*\*S7/);
    assert.doesNotMatch(body, /актуализируется относительно dev|выполнить выбранные адресные проверки S6|Следующий шаг на момент события/);
    assert.match(body, phase === 'review' ? /Возобновлено получение результата уже запрошенного код-ревью/ : /Возобновлено слияние уже подготовленной задачи/);
  }
  const ship = fixture([{ kind: 'admitted', phase: 'ready-to-merge', track: 'ship' }], {
    tasks: { 9: { reviewEntry: 1, status: 'S6-in-progress' } }, active: { issue: 9, phase: 'ready-to-merge' },
  });
  await ship.publish(); assert.match(ship.bodies()[0], /Статус остаётся \*\*S6/);
  assert.match(ship.bodies()[0], /Индивидуальное ревью для ship не предусмотрено/);
});

test('an explicit selection publishes only those message IDs and leaves other events pending', async () => {
  const f = fixture([{ kind: 'queued' }, { kind: 'admitted' }, { kind: 'queued', issue: 10 }]);
  const selected = await publishServiceMessages({ queue: f.queue, api: f.api, eventId: 'selected', onlyMessageIds: ['event-1'] });
  assert.deepEqual(selected.published.map(row => row.messageId), ['event-1']);
  assert.equal(f.state.events['event-0'].message.delivered, undefined);
  assert.equal(f.state.events['event-2'].message.delivered, undefined);
  const empty = await publishServiceMessages({ queue: f.queue, api: f.api, eventId: 'empty', onlyMessageIds: [] });
  assert.deepEqual(empty, { published: [], pending: [] }); assert.equal(f.comments.size, 1);
  assert.deepEqual((await f.publish()).published.map(row => row.messageId), ['event-0', 'event-2']);
});

test('two failures from different entries survive a newer notice and keep their own details', async () => {
  const f = fixture([
    { kind: 'return', notice: { key: '1:checks-failed', reason: 'checks-failed', entry: 1, detail: 'publication case failed', reportUrl: 'https://example.com/run/1' } },
    { kind: 'return', notice: { key: '2:checks-failed', reason: 'checks-failed', entry: 2, detail: 'retry case failed', reportUrl: 'https://example.com/run/2' } },
  ], { tasks: { 9: { status: 'S6-in-progress', reviewEntry: 2, notice: { key: '2:checks-failed', status: 'pending' } } } });
  await publishServiceMessages({ queue: f.queue, api: f.api, eventId: 'first-return', onlyMessageIds: ['event-0'] });
  assert.equal(f.state.tasks[9].notice.status, 'pending');
  assert.match(f.bodies()[0], /вход 1/); assert.match(f.bodies()[0], /publication case failed/);
  assert.match(f.bodies()[0], /https:\/\/example.com\/run\/1/);
  await f.publish(); assert.equal(f.comments.size, 2); assert.equal(f.state.tasks[9].notice.status, 'delivered');
  assert.match(f.bodies()[1], /вход 2/); assert.match(f.bodies()[1], /retry case failed/);
  assert.doesNotMatch(f.bodies()[1], /Состояние задачи на момент публикации отличается/);
  assert.deepEqual(f.deliveries.map(event => event.type), ['task-notice', 'message-delivered', 'task-notice', 'message-delivered']);
});

test('return messages do not claim an unconfirmed S7 to S6 transition', async () => {
  const f = fixture([{ kind: 'return', notice: { key: '1:retry', entry: 1, fromStatus: 'S7-code-review', reason: 'review-retry-exhausted' } }], {
    tasks: { 9: { status: 'S6-in-progress', reviewEntry: 1 } },
  });
  await f.publish(); assert.doesNotMatch(f.bodies()[0], /Переведена/);
  assert.match(f.bodies()[0], /Статус остаётся \*\*S6/);
  assert.match(f.bodies()[0], /не отрицательный содержательный вердикт/);
  const confirmed = fixture([{ kind: 'return', notice: { key: '1:retry', entry: 1, fromStatus: 'S7-code-review',
    transitionConfirmed: true, reason: 'review-retry-exhausted' } }], { tasks: { 9: { status: 'S6-in-progress', reviewEntry: 1 } } });
  await confirmed.publish(); assert.match(confirmed.bodies()[0], /Переведена \*\*S7.*→ S6/);
});

test('lost return acknowledgement retries its immutable comment before acknowledging both records', async () => {
  const f = fixture([{ kind: 'return', notice: { key: '1:checks-failed', reason: 'checks-failed', entry: 1 } }], {
    tasks: { 9: { status: 'S6-in-progress', reviewEntry: 1, notice: { key: '1:checks-failed', status: 'pending' } } },
  });
  f.failNextAcknowledgement(); assert.equal((await f.publish()).pending.length, 1);
  assert.equal(f.state.events['event-0'].message.delivered, undefined); assert.equal(f.state.tasks[9].notice.status, 'pending');
  const original = f.bodies()[0];
  assert.equal((await f.publish()).published.length, 1); assert.equal(f.comments.size, 1); assert.equal(f.bodies()[0], original);
  assert.equal(f.state.tasks[9].notice.status, 'delivered'); assert.equal(f.state.events['event-0'].message.delivered, true);
});

test('old technical S4 failure remains visible after a newer spec reaches S5 without claiming S4 is current', async () => {
  const f = fixture([{ kind: 'spec-attention', notice: { key: 'spec:9:old', reason: 'review workflow unavailable',
    reportUrl: 'https://example.com/spec/old' } }], { status: 'S5-ready', specReviews: {
    9: { requestId: 'spec:9:new', status: 'accepted', notice: { key: 'spec:9:new', status: 'pending' } },
  } });
  await f.publish(); const body = f.bodies()[0];
  assert.match(body, /Текущий статус \*\*S5/);
  assert.doesNotMatch(body, /Статус остаётся \*\*S4|Переведена/);
  assert.match(body, /Это не отрицательное ревью ТЗ/);
  assert.match(body, /review workflow unavailable/);
  assert.match(body, /https:\/\/example.com\/spec\/old/);
  assert.deepEqual(f.deliveries.map(event => event.type), ['spec-notice', 'message-delivered']);
  assert.equal(f.state.specReviews[9].notice.status, 'pending');
  assert.equal(f.state.events['event-0'].message.delivered, true);
  const current = fixture([{ kind: 'spec-attention', notice: { key: 'spec:9:old' } }], { status: 'S4-spec-review',
    specReviews: { 9: { requestId: 'spec:9:old', notice: { key: 'spec:9:old', status: 'pending' } } } });
  await current.publish(); assert.match(current.bodies()[0], /Статус остаётся \*\*S4/);
  assert.equal(current.state.specReviews[9].notice.status, 'delivered');
});

test('changing submitted spec material explains the new round without erasing the preceding request', async () => {
  const f = fixture([{ kind: 'spec-replaced', previousRound: 1, round: 2 }], { status: 'S4-spec-review',
    specReviews: { 9: { requestId: 'spec:9:new', round: 2 } } });
  await f.publish(); const body = f.bodies()[0];
  assert.match(body, /Статус остаётся \*\*S4/);
  assert.match(body, /предыдущей редакции.*раунд 1/);
  assert.match(body, /новая редакция для раунда 2/);
  assert.match(body, /Предыдущий запрос сохранён/);
  assert.doesNotMatch(body, /Следующий шаг на момент события/);
  const late = fixture([{ kind: 'spec-replaced', previousRound: 1, round: 2 }], { status: 'S5-ready',
    specReviews: { 9: { requestId: 'spec:9:new', round: 2 } } });
  await late.publish(); assert.match(late.bodies()[0], /Текущий статус \*\*S5/);
  assert.doesNotMatch(late.bodies()[0], /Статус остаётся \*\*S4|Переведена/);
});
