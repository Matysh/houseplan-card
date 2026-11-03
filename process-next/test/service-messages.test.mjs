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
  const f = fixture([{ kind: 'dev-build' }], { status: 'S8-merged' });
  assert.equal((await f.publish()).published.length, 1);
  const previous = f.bodies()[0];
  assert.equal((await f.publish()).published.length, 0);
  assert.equal(f.comments.size, 1); assert.equal(f.deliveries.length, 1); assert.equal(f.bodies()[0], previous);
});

test('a failed publication remains pending and resumes on the next tick', async () => {
  const f = fixture([{ kind: 'dev-build' }], { status: 'S8-merged' }); f.failNextPost();
  assert.equal((await f.publish()).pending.length, 1);
  assert.equal(f.state.events['event-0'].message.delivered, undefined);
  assert.equal((await f.publish()).published.length, 1); assert.equal(f.comments.size, 1);
});

test('lost state acknowledgement reuses the comment marker without rewriting history', async () => {
  const f = fixture([{ kind: 'dev-build' }]); f.failNextAcknowledgement();
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

test('ship S6 and retained accepted review produce no separate submission comment', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'ready-to-merge', track: 'ship', evidence: {
    name: 'Проверки публикации комментариев', durationMs: 3400, reportPath: 'artifacts/process-next/report.json',
    results: [{ id: 'publication', status: 'passed' }, { id: 'syntax', status: 'reused' }],
  } }]);
  await f.publish(); assert.equal(f.comments.size, 0); assert.equal(f.state.events['event-0'].message.delivered, true);
  const retained = fixture([{ kind: 's6-complete', phase: 'ready-to-merge' }]);
  await retained.publish(); assert.equal(retained.comments.size, 0);
});

test('a failed event preserves order for its issue while other issues can publish', async () => {
  const f = fixture([{ kind: 'return', reason: 'checks-failed' }, { kind: 'dev-build' }, { kind: 'dev-build', issue: 10 }]); f.failNextPost();
  const first = await f.publish();
  assert.equal(first.pending.length, 2); assert.deepEqual(first.published.map(row => row.issue), [10]);
  assert.equal((await f.publish()).published.length, 2);
  assert.deepEqual([...f.comments.values()].map(row => row.number), [10, 9, 9]);
  assert.match(f.bodies()[1], /Завершение приостановлено/); assert.match(f.bodies()[2], /доставлено в dev-build/);
});

test('reentry and later queue phase make an old same-status event explicitly historical', async () => {
  const f = fixture([{ kind: 's6-complete', phase: 'review' }], { tasks: { 9: { reviewEntry: 2 } }, waiting: [9] });
  await f.publish(); assert.match(f.bodies()[0], /Состояние задачи на момент публикации отличается/);
  const advanced = fixture([{ kind: 's6-complete', phase: 'review' }], {
    tasks: { 9: { reviewEntry: 1 } }, active: { issue: 9, phase: 'ready-to-merge' },
  });
  await advanced.publish(); assert.match(advanced.bodies()[0], /Следующий шаг на момент события/);
});

test('resynchronization is quiet while confirmed dev-build delivery remains visible', async () => {
  const sync = fixture([{ kind: 'resynchronize', phase: 'sync' }]);
  await sync.publish(); assert.equal(sync.comments.size, 0); assert.equal(sync.state.events['event-0'].message.delivered, true);
  const build = fixture([{ kind: 'dev-build' }], { status: 'S8-merged' });
  await build.publish(); assert.match(build.bodies()[0], /не подтверждает, что браузер/);
  assert.match(build.bodies()[0], /Статус остаётся \*\*S8/);
});

test('readmission of review or merge is silent for all tracks', async () => {
  for (const phase of ['review', 'ready-to-merge']) {
    const f = fixture([{ kind: 'admitted', phase }], { status: 'S7-code-review',
      tasks: { 9: { reviewEntry: 1, status: 'S7-code-review' } }, active: { issue: 9, phase } });
    await f.publish(); assert.equal(f.comments.size, 0); assert.equal(f.state.events['event-0'].message.delivered, true);
  }
  const ship = fixture([{ kind: 'admitted', phase: 'ready-to-merge', track: 'ship' }], {
    tasks: { 9: { reviewEntry: 1, status: 'S6-in-progress' } }, active: { issue: 9, phase: 'ready-to-merge' },
  });
  await ship.publish(); assert.equal(ship.comments.size, 0);
});

test('an explicit selection publishes only those message IDs and leaves other events pending', async () => {
  const f = fixture([{ kind: 'return', reason: 'checks-failed' }, { kind: 'dev-build' }, { kind: 'dev-build', issue: 10 }]);
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

test('changing material during pending S4 is quiet and preserves previous review history', async () => {
  for (const status of ['S4-spec-review', 'S5-ready']) {
    const f = fixture([{ kind: 'spec-replaced', previousRound: 1, round: 2 }], { status,
      specReviews: { 9: { requestId: 'spec:9:new', round: 2 } } });
    const report = { requestId: 'spec:9:old', issue: 9, kind: 'spec', status: 'pending', markdown: 'Прежний подробный отчёт.' };
    f.state.reviewPublications = { old: structuredClone(report) };
    f.comments.set('previous-report', { number: 9, body: 'Сохранённый предыдущий вердикт.' });
    f.api.getIssue = async () => { throw Error('Quiet replacement must not fetch or publish an issue comment'); };
    assert.deepEqual(await f.publish(), { published: [], pending: [] });
    assert.equal(f.state.events['event-0'].message.delivered, true);
    assert.deepEqual(f.state.reviewPublications.old, report);
    assert.equal(f.state.specReviews[9].requestId, 'spec:9:new');
    assert.deepEqual(f.bodies(), ['Сохранённый предыдущий вердикт.']);
  }
});

test('quiet pending history is consumed without GitHub reads and cannot hold the next visible event', async () => {
  const kinds = ['queued', 'admitted', 'resynchronize', 'spec-skipped', 'spec-requested', 'spec-replaced', 'model-started'];
  const f = fixture([...kinds.map(kind => ({ kind })), { kind: 'dev-build' }], { status: 'S8-merged' });
  let reads = 0;
  f.api.getIssue = async () => { reads++; return f.issue; };
  f.comments.set('old-comment', { number: 9, body: 'Историческое сообщение оставлено без изменений.' });
  f.failNextAcknowledgement();
  const result = await publishServiceMessages({ queue: f.queue, api: f.api, eventId: 'only-delivery', onlyMessageIds: [`event-${kinds.length}`] });
  assert.equal(result.pending.length, 0); assert.equal(result.published.length, 1); assert.equal(reads, 1);
  assert.equal(f.comments.get('old-comment').body, 'Историческое сообщение оставлено без изменений.');
  assert.equal(f.state.events['event-0'].message.delivered, undefined, 'a failed quiet acknowledgement can retry without blocking a real event');
  await f.publish();
  assert.ok(kinds.every((_kind, index) => f.state.events[`event-${index}`].message.delivered));
  assert.equal(f.comments.size, 2); assert.equal(reads, 1);
});

test('code submission has one detailed frozen author context and distinguishes corrections from the first round', async () => {
  for (const resubmission of [false, true]) {
    const f = fixture([{ kind: 's6-complete', phase: 'review', newReview: true, resubmission,
      reviewChanges: '### Исправления по предыдущему ревью\n- Отмена: остановлен старый запрос.\n- Повтор: сохранён результат.',
      fromStatus: 'S6-in-progress', toStatus: 'S7-code-review', transitionConfirmed: true,
      evidence: { name: 'Адресные проверки', durationMs: 3400, results: [{ id: 'cancel', status: 'passed' }, { id: 'retry', status: 'reused' }] },
    }], { status: 'S7-code-review' });
    f.issue.body = 'Поздняя редакция, её нельзя подставлять в старый раунд.';
    await f.publish(); await f.publish();
    assert.equal(f.comments.size, 1);
    const body = f.bodies()[0];
    assert.match(body, resubmission ? /Внесены правки по код-ревью; повторно передано/ : /Передано на код-ревью/);
    assert.match(body, /Переведена \*\*S6.*→ S7/);
    assert.match(body, /3.4 с/); assert.match(body, /Зачтены прежние результаты: retry/);
    assert.match(body, /<details>[\s\S]*Отмена: остановлен старый запрос[\s\S]*Повтор: сохранён результат[\s\S]*<\/details>/);
    assert.doesNotMatch(body, /Поздняя редакция/);
  }
});

test('spec corrections preserve their own round and confirmed S3 to S4 transition', async () => {
  const f = fixture([{ kind: 'spec-resubmitted', requestId: 'spec:9:round2', previousRound: 1, round: 2,
    fromStatus: 'S3-spec', toStatus: 'S4-spec-review', transitionConfirmed: true,
    reviewChanges: 'AC2 уточнён: возврат не теряет черновик. Альтернатива ревьюера принята.',
  }], { status: 'S4-spec-review', specReviews: { 9: { requestId: 'spec:9:round2', round: 2, status: 'pending' } } });
  await f.publish();
  assert.equal(f.comments.size, 1); assert.match(f.bodies()[0], /Внесены правки по ревью ТЗ; повторно передано/);
  assert.match(f.bodies()[0], /Переведена \*\*S3.*→ S4/); assert.match(f.bodies()[0], /AC2 уточнён/);
  assert.match(f.bodies()[0], /прежний отрицательный вердикт остаётся в истории/);
  const absent = fixture([{ kind: 'spec-resubmitted', requestId: 'spec:9:round2', round: 2 }], { status: 'S4-spec-review' });
  await absent.publish(); assert.match(absent.bodies()[0], /описание исправлений исполнитель не приложил/);
});

test('long author corrections are fully delivered in bounded collapsed parts and retry preserves already posted history', async () => {
  const changes = '<details>\n<summary>Подробности</summary>\n' + '<Причина & ответ>'.repeat(12_000) + '\n</details>';
  const f = fixture([{ kind: 'spec-resubmitted', requestId: 'spec:9:round2', round: 2, reviewChanges: changes }], { status: 'S4-spec-review' });
  const upsert = f.api.upsertComment; let failed = false;
  f.api.upsertComment = async (issue, comment) => {
    if (!failed && comment.marker.includes(':part:2')) { failed = true; throw Error('second part delivery failed'); }
    return upsert(issue, comment);
  };
  assert.equal((await f.publish()).pending.length, 1); const first = f.bodies()[0];
  f.issue.labels = ['S5-ready'];
  assert.equal((await f.publish()).published.length, 1);
  assert.equal(f.bodies()[0], first); assert.ok(f.comments.size > 1);
  assert.ok(f.bodies().every(body => body.length < 65_000 && body.includes('<details>') && body.includes('</details>')));
  const restored = f.bodies().map(body => /<pre>([\s\S]*?)<\/pre>/.exec(body)?.[1] ?? '').join('')
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  assert.equal(restored, changes);
  assert.equal(f.state.events['event-0'].message.delivered, true);
});
