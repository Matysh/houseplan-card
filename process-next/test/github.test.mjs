import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitHubClient, GitHubQueueStore, GitHubError, GitAdapter, runGit, sha256 } from '../lib/github.mjs';
import { initialQueueState, reduceQueue, StateConflict } from '../lib/queue.mjs';
import { ReleaseGitAdapter } from '../lib/release.mjs';
const A = 'a'.repeat(40), B = 'b'.repeat(40);
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body,
  arrayBuffer: async () => Buffer.from(body) });

test('S8 removes the personal to_release label without assigning it or touching unrelated labels', async () => {
  const labels = new Set(['S7-code-review', 'track:show', 'to_release', 'kind:feature']), writes = [];
  const client = new GitHubClient({ owner: 'o', repo: 'r', token: 'fixture', activated: true,
    fetchImpl: async (url, options) => {
      const body = options.body && JSON.parse(options.body); writes.push({ method: options.method, url, body });
      if (options.method === 'POST') { body.labels.forEach(label => labels.add(label)); return response([...labels]); }
      const label = decodeURIComponent(url.split('/').at(-1));
      return response({}, labels.delete(label) ? 204 : 404);
    } });
  const staleLabels = [...labels];
  await client.moveStatus(1, 'S8-merged', staleLabels);
  await client.moveStatus(1, 'S8-merged', staleLabels); // metadata retry after an ambiguous response
  assert.deepEqual([...labels].sort(), ['S8-merged', 'kind:feature', 'track:show']);
  assert.ok(writes.filter(row => row.method === 'POST').every(row => !row.body.labels.includes('to_release')));
  writes.length = 0;
  await client.moveStatus(2, 'S6-in-progress', ['to_release', 'S5-ready']);
  assert.ok(!writes.some(row => row.method === 'DELETE' && row.url.endsWith('/to_release')));
});

test('GitHub writes default to a plan without network; activation requires an explicit token', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response({}); };
  const client = new GitHubClient({ owner: 'owner', repo: 'repo', fetchImpl });
  assert.equal((await client.updateIssue(1, { state: 'closed' })).planned, true); assert.equal(calls, 0);
  client.activated = true; await assert.rejects(client.updateIssue(1, { state: 'closed' }), /credentials/); assert.equal(calls, 0);
});

test('GitHub API and upload transports time out; request cancellation reaches fetch', async () => {
  const observed = [];
  const fetchImpl = (_url, { signal }) => new Promise((resolve, reject) => {
    observed.push(signal);
    const timer = setTimeout(() => resolve(response({})), 1000);
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
  });
  const client = new GitHubClient({ owner: 'o', repo: 'r', token: 'fixture', activated: true, fetchImpl, requestTimeoutMs: 15 });
  await assert.rejects(client.getIssue(1), error => error.name === 'TimeoutError');
  await assert.rejects(client.uploadReleaseAsset(1, { name: 'test.zip', bytes: Buffer.from('fixture') }), error => error.name === 'TimeoutError');
  const controller = new AbortController(); controller.abort(Error('stopped by executor'));
  await assert.rejects(client.request('GET', `${client.root}/issues/1`, undefined, { signal: controller.signal }), /stopped by executor/);
  assert.equal(observed.length, 3); assert.ok(observed.every(signal => signal.aborted));
  assert.throws(() => new GitHubClient({ owner: 'o', repo: 'r', requestTimeoutMs: Infinity }), /timeout/);
});
test('GitHub Contents CAS passes exact blob identity and maps a conflict to retry', async () => {
  let posted;
  const client = { activated: true, getRef: async () => ({ object: { sha: A } }), putContents: async (path, value) => {
    posted = value; throw new GitHubError(409, 'conflict'); } };
  const store = new GitHubQueueStore(client);
  await assert.rejects(store.compareAndSwap({ blobSha: B, headSha: A }, initialQueueState()), StateConflict);
  assert.equal(posted.previousSha, B); assert.equal(posted.branch, 'process-state');
});
test('missing state branch is not silently initialized and a read uses the observed immutable commit', async () => {
  const missing = new GitHubQueueStore({ getRef: async () => { throw new GitHubError(404, 'missing'); } });
  await assert.rejects(missing.read(), /explicit activation/);
  let observed;
  const store = new GitHubQueueStore({ getRef: async () => ({ object: { sha: A } }), getContents: async (path, ref) => {
    observed = ref; return { sha: B, encoding: 'base64', content: Buffer.from(JSON.stringify(initialQueueState())).toString('base64') }; } });
  const value = await store.read(); assert.equal(observed, A); assert.equal(value.version.blobSha, B);
});

test('state initialization publishes only its JSON, without inheriting source workflows', async () => {
  for (const [branch, path] of [['process-state', 'queue.json'], ['process-release-state', 'releases.json']]) {
    const writes = [], client = { activated: true, root: '/repos/o/r',
      getRef: async () => { throw new GitHubError(404, 'missing'); },
      request: async (method, url, body) => { writes.push({ method, url, body }); return { sha: url.endsWith('/trees') ? A : B }; },
      createRef: async (name, commit) => { writes.push({ name, commit }); return { object: { sha: commit } }; } };
    const store = new GitHubQueueStore(client, { branch, path });
    await store.initialize({ baseSha: A, confirmed: true });
    assert.equal(writes[0].body.base_tree, undefined);
    assert.deepEqual(writes[0].body.tree.map(row => row.path), [path]);
    assert.deepEqual(JSON.parse(writes[0].body.tree[0].content), initialQueueState());
    assert.deepEqual(writes[1].body.parents, [A]);
    assert.equal(writes[1].body.tree, A);
    assert.deepEqual(writes[2], { name: branch, commit: B });
    client.getRef = async () => ({ object: { sha: B } }); writes.length = 0;
    await assert.rejects(store.initialize({ baseSha: A, confirmed: true }), /already exists/);
    assert.deepEqual(writes, []);
  }
});
test('publication evidence checks the actual tag commit and downloaded bytes', async () => {
  const bytes = Buffer.from('artifact'), client = new GitHubClient({ owner: 'o', repo: 'r', fetchImpl: async url => {
    if (url.includes('/releases/tags/')) return response({ id: 1, tag_name: 'v1', draft: false, assets: [{ id: 2, name: 'houseplan.zip' }] });
    if (url.includes('/git/ref/tags/')) return response({ object: { type: 'commit', sha: A } });
    return response(bytes);
  } });
  const request = { tag: 'v1', expectedSha: A, assetName: 'houseplan.zip', expectedDigest: sha256(bytes) };
  assert.equal((await client.verifyPublication(request)).sha, A);
  await assert.rejects(client.verifyPublication({ ...request, expectedSha: B }), /another commit/);
  await assert.rejects(client.verifyPublication({ ...request, expectedDigest: '0'.repeat(64) }), /differs/);
});

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'hp-next-git-')), cwd = join(directory, 'work'), bare = join(directory, 'remote.git');
  t.after(() => rm(directory, { recursive: true, force: true })); await mkdir(cwd);
  const git = async args => (await runGit(args, { cwd })).stdout.trim();
  await git(['init', '-b', 'dev']); await git(['config', 'user.name', 'Test']); await git(['config', 'user.email', 'test@localhost']);
  await git(['config', 'core.hooksPath', join(directory, 'no-hooks')]); await git(['init', '--bare', bare]); await git(['remote', 'add', 'origin', bare]);
  await writeFile(join(cwd, 'file.txt'), 'base'); await git(['add', '.']); await git(['commit', '-m', 'base']); const base = await git(['rev-parse', 'HEAD']);
  await git(['checkout', '-b', 'issue/1']); await writeFile(join(cwd, 'file.txt'), 'candidate'); await git(['commit', '-am', 'candidate']);
  const material = await git(['rev-parse', 'HEAD']);
  let state = initialQueueState(), count = 0;
  const event = value => { state = reduceQueue(state, { id: `e${++count}`, ...value }, { now: 100, leaseMs: 100_000 }); };
  event({ type: 'enqueue', task: { issue: 1, branch: 'issue/1', materialSha: material, track: 'ship', ownerAssigned: true, layer: 'infra' } });
  event({ type: 'admit' }); const token = state.active.token;
  event({ type: 'synchronized', issue: 1, token, expectedBase: base, materialSha: material });
  event({ type: 's6-complete', issue: 1, token, materialSha: material, outcome: 'passed' });
  if (state.active.phase === 'review') event({ type: 'review-complete', issue: 1, token, materialSha: material, verdict: 'accepted' });
  await git(['checkout', '-b', 'process-state', base]); await writeFile(join(cwd, 'queue.json'), JSON.stringify(state));
  await git(['add', 'queue.json']); await git(['commit', '-m', 'queue']); const headSha = await git(['rev-parse', 'HEAD']);
  await git(['push', 'origin', 'dev', 'issue/1', 'process-state']);
  const request = { expectedBase: base, materialSha: material, branch: 'issue/1',
    fence: { state, headSha, token, issue: 1, branch: 'process-state', path: 'queue.json' } };
  return { cwd, bare, git, base, material, state, request, adapter: new GitAdapter({ cwd, activated: true, clock: () => 100 }) };
}

test('real Git atomically merges and records S8; failed comment cannot undo successful merge', async t => {
  const f = await fixture(t);
  const result = await f.adapter.merge({ ...f.request, comment: async () => { throw Error('API down'); } });
  assert.equal(result.merged, true); assert.equal(result.status, 'S8-merged'); assert.equal(result.warnings.length, 1);
  assert.equal(await f.adapter.remoteHead('dev'), f.material); assert.equal(await f.adapter.remoteHead('issue/1'), null);
  const state = JSON.parse(await f.git(['show', `${result.stateCommit}:queue.json`]));
  assert.equal(state.tasks[1].status, 'S8-merged'); assert.equal(state.active, null);
});
test('non-fast-forward material is refused before any remote mutation', async t => {
  const f = await fixture(t), tree = await f.git(['rev-parse', `${f.base}^{tree}`]);
  const unrelated = await f.git(['commit-tree', tree, '-m', 'unrelated']);
  const state = structuredClone(f.state); state.active.materialSha = unrelated;
  await assert.rejects(f.adapter.merge({ ...f.request, materialSha: unrelated, fence: { ...f.request.fence, state } }));
  assert.equal(await f.adapter.remoteHead('dev'), f.base);
});
test('racing dev advance makes the whole atomic merge fail without publishing S8 or deleting the task', async t => {
  const f = await fixture(t);
  await f.git(['checkout', '-b', 'racer', f.base]); await writeFile(join(f.cwd, 'other.txt'), 'concurrent');
  await f.git(['add', '.']); await f.git(['commit', '-m', 'concurrent']); const racer = await f.git(['rev-parse', 'HEAD']);
  await f.git(['push', 'origin', 'racer']); let raced = false;
  const run = async (args, options) => {
    if (!raced && args[0] === 'push' && args.includes('--atomic')) {
      raced = true; await runGit(['update-ref', 'refs/heads/dev', racer, f.base], { cwd: f.bare });
    }
    return runGit(args, options);
  };
  await assert.rejects(new GitAdapter({ cwd: f.cwd, activated: true, clock: () => 100, run }).merge(f.request));
  assert.equal(await f.adapter.remoteHead('dev'), racer); assert.equal(await f.adapter.remoteHead('process-state'), f.request.fence.headSha);
  assert.equal(await f.adapter.remoteHead('issue/1'), f.material);
});
test('new queue fence defeats a stale worker even when dev has not moved', async t => {
  const f = await fixture(t), next = structuredClone(f.state); next.revision++; next.active.token = 'new-admission';
  const nextSha = await f.adapter.stateCommit({ parent: f.request.fence.headSha, path: 'queue.json', state: next });
  let raced = false;
  const run = async (args, options) => {
    if (!raced && args[0] === 'push' && args.includes('--atomic')) {
      raced = true; await runGit(['push', 'origin', `${nextSha}:refs/heads/process-state`], { cwd: f.cwd });
    }
    return runGit(args, options);
  };
  await assert.rejects(new GitAdapter({ cwd: f.cwd, activated: true, clock: () => 100, run }).merge(f.request));
  assert.equal(await f.adapter.remoteHead('dev'), f.base); assert.equal(await f.adapter.remoteHead('process-state'), nextSha);
});
test('task branch advanced after merge material is not deleted', async t => {
  const f = await fixture(t); await f.git(['checkout', 'issue/1']); await writeFile(join(f.cwd, 'later.txt'), 'later');
  await f.git(['add', '.']); await f.git(['commit', '-m', 'later']); await f.git(['push', 'origin', 'issue/1']);
  assert.equal(await f.adapter.deleteBranchIfUnchanged('issue/1', f.material), false);
  assert.notEqual(await f.adapter.remoteHead('issue/1'), f.material);
});
test('release refs publish the exact tag and fast-forward main; an unrelated candidate cannot rewrite main', async t => {
  const f = await fixture(t); await f.git(['branch', 'main', f.base]); await f.git(['push', 'origin', 'main']);
  await f.adapter.publishCandidateRefs({ materialSha: f.material, tag: 'v1.0.0', kind: 'stable', expectedMain: f.base });
  assert.equal(await f.adapter.remoteHead('main'), f.material);
  const tag = await f.git(['ls-remote', '--tags', 'origin', 'refs/tags/v1.0.0', 'refs/tags/v1.0.0^{}']);
  assert.ok(tag.split('\n').some(row => row === `${f.material}\trefs/tags/v1.0.0^{}`));
  const tagObject = tag.split('\n').find(row => row.endsWith('refs/tags/v1.0.0')).split('\t')[0];
  assert.equal(await f.git(['cat-file', '-t', tagObject]), 'tag');
  const retried = await f.adapter.publishCandidateRefs({ materialSha: f.material, tag: 'v1.0.0', kind: 'stable', expectedMain: f.base });
  assert.equal(retried.mainAlreadyContains, true); // same command after a lost publication response never moves main backwards
  const tree = await f.git(['rev-parse', `${f.base}^{tree}`]), unrelated = await f.git(['commit-tree', tree, '-m', 'unrelated']);
  await assert.rejects(f.adapter.publishCandidateRefs({ materialSha: unrelated, tag: 'v1.0.1', kind: 'stable', expectedMain: f.material }));
  assert.equal(await f.adapter.remoteHead('main'), f.material);
  assert.equal(await f.git(['ls-remote', '--tags', 'origin', 'refs/tags/v1.0.1']), '');
});

test('two stable releases and a hotfix retain main ancestry through queued tag-return merges', async t => {
  const f = await fixture(t), adapter = new ReleaseGitAdapter({ cwd: f.cwd, activated: true, clock: () => 100 });
  await f.adapter.merge(f.request); // first product task reaches dev
  await f.git(['branch', 'main', f.base]); await f.git(['push', 'origin', 'main']);
  let index = 0;
  const commit = async (branch, base, file, content) => {
    await f.git(['checkout', '-b', branch, base]); await writeFile(join(f.cwd, file), content);
    await f.git(['add', file]); await f.git(['commit', '-m', branch]); return f.git(['rev-parse', 'HEAD']);
  };
  const queuedReturn = async (publishedSha, tag, issue) => {
    const candidate = { status: 'published', sha: publishedSha, tag };
    const prepared = await adapter.prepareDevReturn({ candidate, issue, worktree: join(f.cwd, '..', `port-${issue}`) });
    assert.equal(prepared.task.syncMode, 'merge'); assert.equal(prepared.task.mergeSourceSha, publishedSha);
    const headSha = await adapter.remoteHead('process-state');
    await adapter.ensureCommit(headSha);
    let state = JSON.parse(await f.git(['show', `${headSha}:queue.json`]));
    const apply = event => { state = reduceQueue(state, { id: `return${++index}`, ...event }, { now: 100 }); };
    apply({ type: 'enqueue', task: prepared.task }); apply({ type: 'admit' }); const token = state.active.token;
    const expectedBase = await adapter.remoteHead('dev');
    apply({ type: 'synchronized', issue, token, expectedBase, materialSha: prepared.task.materialSha });
    apply({ type: 's6-complete', issue, token, materialSha: prepared.task.materialSha, outcome: 'passed', evidence: { fixture: true } });
    apply({ type: 'review-complete', issue, token, materialSha: prepared.task.materialSha, verdict: 'accepted' });
    const queueSha = await adapter.stateCommit({ parent: headSha, path: 'queue.json', state });
    await f.git(['push', 'origin', `${queueSha}:refs/heads/process-state`]);
    await adapter.merge({ expectedBase, materialSha: prepared.task.materialSha, branch: prepared.task.branch,
      fence: { headSha: queueSha, state, token, issue, path: 'queue.json', branch: 'process-state' } });
    const verified = await adapter.verifyDevReturn(publishedSha);
    assert.equal((await adapter.prepareDevReturn({ candidate, issue })).alreadyIncluded, true);
    return verified.devSha;
  };
  const stable1 = await commit('release/one', f.material, 'version.txt', '1');
  await adapter.publishCandidateRefs({ materialSha: stable1, tag: 'v1', kind: 'stable', expectedMain: f.base });
  const concurrent = await commit('feature/next', f.material, 'feature.txt', 'next');
  await f.git(['push', 'origin', `${concurrent}:refs/heads/dev`]);
  await assert.rejects(adapter.resolveSource({ kind: 'beta', published: { stable: { sha: stable1, tag: 'v1' } } }), /through the queue/);
  const dev1 = await queuedReturn(stable1, 'v1', 2);
  const stable2 = await commit('release/two', dev1, 'version.txt', '2');
  await adapter.publishCandidateRefs({ materialSha: stable2, tag: 'v2', kind: 'stable', expectedMain: stable1 });
  await queuedReturn(stable2, 'v2', 3);
  const hotfix = await commit('release/hotfix', stable2, 'fix.txt', 'fixed');
  await adapter.publishCandidateRefs({ materialSha: hotfix, tag: 'v2.0.1', kind: 'hotfix', expectedMain: stable2 });
  const afterFix = await queuedReturn(hotfix, 'v2.0.1', 4);
  const stable3 = await commit('release/three', afterFix, 'version.txt', '3');
  await adapter.publishCandidateRefs({ materialSha: stable3, tag: 'v3', kind: 'stable', expectedMain: hotfix });
  assert.equal(await adapter.remoteHead('main'), stable3);
  assert.equal((await adapter.fixPortPlan({ from: stable2, to: hotfix })).commands[0][1], 'merge');
});


test('#1186 Actions archives use REST JSON media while release assets retain octet-stream', async () => {
  const bytes = Buffer.from('PK native archive fixture'), seen = [];
  const client = new GitHubClient({ owner: 'o', repo: 'r', token: 'fixture', activated: true,
    fetchImpl: async (url, { headers }) => {
      seen.push({ url, accept: headers.Accept });
      if (url.endsWith('/actions/artifacts/42/zip'))
        return headers.Accept === 'application/vnd.github+json' ? response(bytes) : response({}, 415);
      if (url.endsWith('/releases/assets/7'))
        return headers.Accept === 'application/octet-stream' ? response(bytes) : response({}, 415);
      throw Error('Unexpected fixture endpoint');
    } });
  assert.deepEqual(await client.request('GET', `${client.root}/actions/artifacts/42/zip`, undefined, { binary: true }), bytes);
  assert.deepEqual(await client.downloadAsset(7), bytes);
  assert.deepEqual(seen.map(row => row.accept), ['application/vnd.github+json', 'application/octet-stream']);
});
